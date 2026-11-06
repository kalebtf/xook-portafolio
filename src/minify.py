"""Comprime JS y CSS con esbuild (sin source maps). Si esbuild no está instalado, deja el código igual."""
import shutil, subprocess
from pathlib import Path

ROOT = Path(__file__).parent.parent
_BIN = ROOT / "node_modules" / ".bin" / "esbuild"
ESBUILD = str(_BIN) if _BIN.exists() else shutil.which("esbuild")
_warned = False

def _run(code: str, loader: str) -> str:
    global _warned
    if not ESBUILD:
        if not _warned:
            print("Aviso: esbuild no está instalado (npm install); el código se publica sin comprimir.")
            _warned = True
        return code
    r = subprocess.run([ESBUILD, f"--loader={loader}", "--minify", "--target=es2020", "--log-level=error"],
                       input=code, capture_output=True, text=True, check=True)
    return r.stdout.strip()

def js(code: str) -> str: return _run(code, "js")
def css(code: str) -> str: return _run(code, "css")
