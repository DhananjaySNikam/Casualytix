"""One origin, one preview port. Installs pinned Python dependencies on fresh clones."""

from pathlib import Path
import hashlib, os, subprocess, venv

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)


def python_env():
    folder = ROOT / ".venv"
    py = folder / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not py.exists():
        venv.EnvBuilder(with_pip=True).create(folder)
    digest = hashlib.sha256((ROOT / "requirements.txt").read_bytes()).hexdigest()
    stamp = folder / ".causalytix-deps"
    if not stamp.exists() or stamp.read_text() != digest:
        subprocess.run(
            [
                str(py),
                "-m",
                "pip",
                "install",
                "--disable-pip-version-check",
                "-q",
                "-r",
                "requirements.txt",
            ],
            check=True,
        )
        stamp.write_text(digest)
    return str(py)


if __name__ == "__main__":
    py = python_env()
    subprocess.run(["npm", "run", "build"], check=True)
    args = [
        py,
        "-m",
        "uvicorn",
        "backend.app:app",
        "--host",
        "0.0.0.0",
        "--port",
        os.getenv("PORT", "5173"),
    ]
    os.execv(py, args)
