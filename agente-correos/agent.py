"""Email agent: Claude extracts data (tool use) -> Pydantic validates -> SQLite saves.

Usage:  python agent.py emails_ejemplo.json
"""
import json
import sqlite3
import sys
from datetime import date
from typing import Literal, Optional

from anthropic import Anthropic
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError, model_validator

load_dotenv()

MODEL = "claude-haiku-5-5"
DB_FILE = "inquiries.db"
client = Anthropic()


# ---------------------------------------------------------------------------
# 1) The "form" Claude must fill in (tool use). Types are strict.
# ---------------------------------------------------------------------------
SAVE_INQUIRY_TOOL = {
    "name": "save_inquiry",
    "description": "Save the data extracted from one customer email.",
    "input_schema": {
        "type": "object",
        "properties": {
            "sender_name": {"type": ["string", "null"], "description": "Name of the sender, or null"},
            "category": {
                "type": "string",
                "enum": [
                    "reservation", "catering_quote", "complaint", "question",
                    "delivery_order", "invoice_request", "cancellation", "not_relevant",
                ],
            },
            "request_summary": {"type": "string", "description": "One short sentence in English"},
            "requested_date": {
                "type": ["string", "null"],
                "description": "The date the email is about (reservation day, event day, purchase day, or incident day), as YYYY-MM-DD. null if no date.",
            },
            "amount": {"type": ["number", "null"]},
            "currency": {"type": ["string", "null"], "enum": ["MXN", "USD", None]},
            "language": {"type": "string", "enum": ["es", "en"]},
            "needs_human_review": {
                "type": "boolean",
                "description": "true if it is a complaint or refund, OR the email has more than one request, OR key details are vague. Otherwise false.",
            },
        },
        "required": [
            "sender_name", "category", "request_summary", "requested_date",
            "amount", "currency", "language", "needs_human_review",
        ],
    },
}


# ---------------------------------------------------------------------------
# 2) The "validator": Pydantic checks Claude's answer before we trust it.
# ---------------------------------------------------------------------------
class Inquiry(BaseModel):
    sender_name: Optional[str]
    category: Literal[
        "reservation", "catering_quote", "complaint", "question",
        "delivery_order", "invoice_request", "cancellation", "not_relevant",
    ]
    request_summary: str
    requested_date: Optional[date]  # must be a real date like 2026-11-14
    amount: Optional[float]
    currency: Optional[Literal["MXN", "USD"]]
    language: Literal["es", "en"]
    needs_human_review: bool

    @model_validator(mode="after")
    def amount_needs_currency(self):
        # Business rule: a money amount without a currency is useless.
        if self.amount is not None and self.currency is None:
            raise ValueError("amount was given but currency is missing")
        if self.amount is not None and self.amount < 0:
            raise ValueError("amount cannot be negative")
        return self


class ExtractionFailed(Exception):
    pass


# ---------------------------------------------------------------------------
# 3) The "filing cabinet": SQLite.
# ---------------------------------------------------------------------------
def init_db(path: str = DB_FILE) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS inquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at TEXT,
            sender_name TEXT,
            category TEXT,
            request_summary TEXT,
            requested_date TEXT,
            amount REAL,
            currency TEXT,
            language TEXT,
            needs_human_review INTEGER,
            original_text TEXT
        )"""
    )
    return conn


def save_inquiry(conn: sqlite3.Connection, record: Inquiry, received_at: str, text: str) -> None:
    d = record.model_dump(mode="json")  # dates become "YYYY-MM-DD" text
    conn.execute(
        """INSERT INTO inquiries (received_at, sender_name, category, request_summary,
               requested_date, amount, currency, language, needs_human_review, original_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (received_at, d["sender_name"], d["category"], d["request_summary"],
         d["requested_date"], d["amount"], d["currency"], d["language"],
         int(d["needs_human_review"]), text),
    )
    conn.commit()


# ---------------------------------------------------------------------------
# 4) The agent: ask Claude -> validate -> retry once if invalid.
# ---------------------------------------------------------------------------
def ask_claude(text: str, received_at: str, previous_error: Optional[str] = None):
    prompt = (
        "You read customer emails for a small cafeteria in Mexico. "
        "Extract the data by calling the save_inquiry tool.\n"
        f"Today's date is {received_at}. Turn words like 'tomorrow' or 'Friday' into real dates.\n"
        "If a value is not in the email, use null.\n"
    )
    if previous_error:
        prompt += f"\nYour previous answer was rejected by the validator: {previous_error}\nFix it.\n"
    prompt += f'\nEmail:\n"""{text}"""'

    response = client.messages.create(
        model=MODEL,
        max_tokens=600,
        tools=[SAVE_INQUIRY_TOOL],
        tool_choice={"type": "tool", "name": "save_inquiry"},  # force the tool call
        messages=[{"role": "user", "content": prompt}],
    )
    for block in response.content:
        if block.type == "tool_use":
            return block.input, response.usage
    raise ExtractionFailed("Claude did not call the tool")


def process_email(text: str, received_at: str, conn: Optional[sqlite3.Connection] = None):
    """Returns (Inquiry, tokens_in, tokens_out, retries). Saves to DB if conn is given."""
    tokens_in = tokens_out = 0
    error = None
    for attempt in range(2):  # first try + ONE retry
        raw, usage = ask_claude(text, received_at, error)
        tokens_in += usage.input_tokens
        tokens_out += usage.output_tokens
        try:
            record = Inquiry(**raw)
        except (ValidationError, TypeError) as e:
            error = str(e)
            continue
        if conn is not None:
            save_inquiry(conn, record, received_at, text)
        return record, tokens_in, tokens_out, attempt
    raise ExtractionFailed(f"Invalid after retry: {error}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "emails_ejemplo.json"
    with open(path, encoding="utf-8") as f:
        emails = json.load(f)["emails"]

    conn = init_db()
    for e in emails:
        try:
            rec, _, _, retries = process_email(e["text"], e["received_at"], conn)
            flag = "  [REVIEW]" if rec.needs_human_review else ""
            print(f"Email {e['id']:>2}: {rec.category:<15} {rec.sender_name or '-':<15}{flag}")
        except ExtractionFailed as err:
            print(f"Email {e['id']:>2}: FAILED ({err})")

    print("\nSaved in", DB_FILE)
    print("Emails that need a human:")
    for row in conn.execute(
        "SELECT sender_name, category, request_summary FROM inquiries WHERE needs_human_review = 1"
    ):
        print("  -", row)
