import io
import json
import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
from dotenv import load_dotenv

load_dotenv()
import jwt
from fastapi import FastAPI, Request, Response, UploadFile, File, HTTPException, Depends
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pypdf import PdfReader
from . import store
from .engine import llm_available
from .models import IncidentInput, StatusInput, Document
from .pdf import report_pdf
from .limits import InputBoundary

KEYFILE = store.DATA / "session.key"
if not KEYFILE.exists():
    try:
        with KEYFILE.open("x") as fh:
            os.chmod(KEYFILE, 0o600)
            fh.write(secrets.token_hex(32))
    except FileExistsError:
        pass
KEY = os.environ.get("SESSION_SECRET") or KEYFILE.read_text()
COOKIE = "cx_workspace"


@asynccontextmanager
async def lifespan(app):
    store.init()
    yield


app = FastAPI(
    title="Causalytix diagnostic gateway",
    version="1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)


@app.middleware("http")
async def integrity(req, call_next):
    res = await call_next(req)
    if req.url.path.startswith("/api/"):
        res.headers["Cache-Control"] = "no-store"
        res.headers["X-Content-Type-Options"] = "nosniff"
    return res


app.add_middleware(InputBoundary)


@app.exception_handler(KeyError)
async def not_found(req, exc):
    return JSONResponse({"detail": "Investigation not found in this workspace."}, 404)


@app.exception_handler(RequestValidationError)
async def validation(req, exc):
    issues = [f"{'.'.join(map(str, e['loc'][1:]))}: {e['msg']}" for e in exc.errors()[:3]]
    return JSONResponse({"detail": "; ".join(issues)}, 422)


def subject(req):
    try:
        return jwt.decode(
            req.cookies.get(COOKIE, ""),
            KEY,
            algorithms=["HS256"],
            issuer="causalytix",
            options={"require": ["sub", "exp"]},
        )["sub"]
    except jwt.InvalidTokenError:
        return None


def owner(req: Request):
    oid = subject(req)
    if not oid:
        raise HTTPException(401, "Workspace session expired. Refresh this page to reconnect.")
    return oid


@app.get("/api/health")
def health():
    with store.db() as db:
        db.execute("SELECT 1 FROM workspaces LIMIT 1")
    return {"status": "online", "storage": "SQLite"}


@app.get("/api/workspace")
def workspace(req: Request, res: Response):
    oid = subject(req)
    if not oid:
        oid = str(uuid4())
        token = jwt.encode(
            {
                "sub": oid,
                "iss": "causalytix",
                "exp": datetime.now(timezone.utc) + timedelta(days=180),
            },
            KEY,
            algorithm="HS256",
        )
        secure = (
            req.url.scheme == "https"
            or req.headers.get("x-forwarded-proto", "").split(",")[0].strip() == "https"
            or req.url.hostname.endswith(".e2b.app")
        )
        res.set_cookie(
            COOKIE,
            token,
            max_age=180 * 86400,
            httponly=True,
            samesite="none" if secure else "lax",
            secure=secure,
        )
        # Partitioned HTTPS cookies also work inside a third-party Arena preview iframe.
        if secure:
            res.headers["set-cookie"] += "; Partitioned"
    store.workspace(oid)
    return {
        "cases": store.listing(oid),
        "llm": llm_available(),
        "model": os.getenv("LLM_MODEL", "gpt-4o-mini"),
        "storage": "SQLite",
        "version": "1.0.0",
    }


@app.post("/api/investigations", status_code=201)
def create(data: IncidentInput, oid=Depends(owner)):
    return store.save(oid, data)


@app.get("/api/investigations/{id}")
def get(id: str, oid=Depends(owner)):
    return store.detail(oid, id)


@app.put("/api/investigations/{id}")
def update(id: str, data: IncidentInput, oid=Depends(owner)):
    return store.save(oid, data, id)


@app.patch("/api/investigations/{id}/status")
def mark(id: str, data: StatusInput, oid=Depends(owner)):
    case = store.detail(oid, id)
    if not case["report"]:
        raise HTTPException(409, "Run an analysis before changing its review status.")
    resolution = None
    if data.status == "Resolved":
        causes = case["report"]["causes"]
        if (
            data.cause_index is None
            or data.cause_index >= len(causes)
            or len(data.note.strip()) < 8
        ):
            raise HTTPException(
                422,
                "Select a cause and describe the observed verification result (at least 8 characters).",
            )
        resolution = json.dumps(
            {
                "cause": causes[data.cause_index]["title"],
                "note": data.note.strip(),
                "at": store.now(),
            }
        )
    with store.db() as db:
        db.execute(
            "UPDATE incidents SET status=?,updated_at=?,resolution_json=? WHERE owner=? AND id=?",
            (data.status, store.now(), resolution, oid, id),
        )
    return store.detail(oid, id)


@app.get("/api/investigations/{id}/snapshot")
def snapshot(id: str, oid=Depends(owner)):
    return store.detail(oid, id, with_vectors=True)


@app.get("/api/investigations/{id}/export/{fmt}")
def export(id: str, fmt: str, oid=Depends(owner)):
    case = store.detail(oid, id)
    if not case["report"]:
        raise HTTPException(409, "Analyze the incident before exporting a report.")
    if fmt not in ["json", "pdf"]:
        raise HTTPException(404, "Unknown report format.")
    return Response(
        report_pdf(case) if fmt == "pdf" else json.dumps(case, indent=2, ensure_ascii=False),
        media_type="application/pdf" if fmt == "pdf" else "application/json",
        headers={"Content-Disposition": f'attachment; filename="{case["ref"]}-report.{fmt}"'},
    )


@app.post("/api/evidence/parse")
def parse(file: UploadFile = File(...), oid=Depends(owner)):
    name = (file.filename or "evidence.txt").replace("\\", "/").split("/")[-1][:160]
    ext = Path(name).suffix.lower()
    raw = file.file.read(2_000_001)
    if len(raw) > 2_000_000:
        raise HTTPException(413, "Each file must be 2 MB or smaller.")
    if ext == ".pdf":
        try:
            reader = PdfReader(io.BytesIO(raw))
            if reader.is_encrypted or len(reader.pages) > 30:
                raise ValueError()
            text = "\n".join(p.extract_text() or "" for p in reader.pages)
        except Exception:
            raise HTTPException(422, "Use an unlocked, text-based PDF of up to 30 pages.")
    elif ext in [".log", ".txt", ".csv", ".json", ".md"]:
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeError:
            raise HTTPException(422, "Save this file as UTF-8 text and try again.")
    else:
        raise HTTPException(415, "Supported evidence: TXT, LOG, CSV, JSON, MD and text-based PDF.")
    if not text.strip() or "\x00" in text:
        raise HTTPException(
            422, "No readable text found. Paste a transcript for scanned documents."
        )
    if len(text) > 80000:
        raise HTTPException(413, "Use a relevant excerpt of 80,000 characters or less.")
    return Document(name=name, text=text)


DIST = Path(__file__).resolve().parents[1] / "dist"
if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/favicon.svg", include_in_schema=False)
def favicon():
    return FileResponse(DIST / "favicon.svg")


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, "Endpoint not found.")
    if not (DIST / "index.html").exists():
        raise HTTPException(503, "Build the frontend with npm run build.")
    return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})
