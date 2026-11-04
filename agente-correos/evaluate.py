"""Score the agent against an answer key.

Usage:  python evaluate.py emails_ejemplo.json
        python evaluate.py emails_test.json      <- the honest "unseen" test
"""
import json
import sys

from agent import ExtractionFailed, process_email

# Fill these in from Anthropic's official pricing page (USD per 1 million tokens).
# Leave as None until you have checked them: the script then prints tokens only.
PRICE_IN_PER_MTOK = None
PRICE_OUT_PER_MTOK = None

# request_summary is free text, so it is not scored by exact match.
SCORED_FIELDS = [
    "sender_name", "category", "requested_date", "amount",
    "currency", "language", "needs_human_review",
]


def main(path: str) -> None:
    with open(path, encoding="utf-8") as f:
        emails = json.load(f)["emails"]

    field_ok = {f: 0 for f in SCORED_FIELDS}
    perfect = failed = total_retries = 0
    tokens_in = tokens_out = 0

    for e in emails:
        try:
            rec, t_in, t_out, retries = process_email(e["text"], e["received_at"], conn=None)
        except ExtractionFailed as err:
            failed += 1
            print(f"Email {e['id']:>2}: FAILED ({err})")
            continue
        tokens_in += t_in
        tokens_out += t_out
        total_retries += retries
        got = rec.model_dump(mode="json")
        wrong = [f for f in SCORED_FIELDS if got[f] != e["expected"][f]]
        for f in SCORED_FIELDS:
            if f not in wrong:
                field_ok[f] += 1
        if not wrong:
            perfect += 1
            print(f"Email {e['id']:>2}: PERFECT")
        else:
            print(f"Email {e['id']:>2}: WRONG: {', '.join(wrong)}")
            for f in wrong:
                print(f"          {f}: got={got[f]!r} expected={e['expected'][f]!r}")

    n = len(emails)
    print(f"\nPerfect emails: {perfect}/{n}   Failed validation: {failed}   Retries used: {total_retries}")
    print("Accuracy per field:")
    for f in SCORED_FIELDS:
        print(f"  {f:<20} {field_ok[f]}/{n}")
    print(f"Tokens used: {tokens_in} in, {tokens_out} out")
    if PRICE_IN_PER_MTOK is not None and PRICE_OUT_PER_MTOK is not None:
        cost = tokens_in / 1e6 * PRICE_IN_PER_MTOK + tokens_out / 1e6 * PRICE_OUT_PER_MTOK
        print(f"Cost: ${cost:.4f} total, ${cost / n:.5f} per email")
    else:
        print("Cost: set PRICE_IN_PER_MTOK / PRICE_OUT_PER_MTOK at the top of evaluate.py")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "emails_ejemplo.json")
