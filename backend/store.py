"""Local SQLite repository. All reads and writes are scoped to a signed workspace."""

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from uuid import uuid4
from .engine import analyze, chunks_for
from .models import IncidentInput
from .seed import CASES

DATA = Path(os.environ.get("CAUSALYTIX_DATA", ".data"))
DATA.mkdir(mode=0o700, parents=True, exist_ok=True)
DB = DATA / "workspace.sqlite3"


def now():
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def db():
    conn = sqlite3.connect(DB, timeout=12)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init():
    with db() as c:
        c.executescript("""PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS workspaces (owner TEXT PRIMARY KEY, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES workspaces(owner), number INTEGER NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,domain TEXT NOT NULL,severity TEXT NOT NULL,system TEXT,timeline TEXT,status TEXT NOT NULL, sample INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL, UNIQUE(owner,number));
        CREATE INDEX IF NOT EXISTS list_by_owner ON incidents(owner,updated_at DESC);
        CREATE TABLE IF NOT EXISTS evidence_docs (case_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,seq INTEGER,name TEXT NOT NULL,content TEXT NOT NULL, PRIMARY KEY(case_id,seq));
        CREATE TABLE IF NOT EXISTS document_chunks (case_id TEXT,doc INTEGER,seq INTEGER,content TEXT,embedding TEXT,PRIMARY KEY(case_id,doc,seq),FOREIGN KEY(case_id,doc) REFERENCES evidence_docs(case_id,seq) ON DELETE CASCADE);
        CREATE TABLE IF NOT EXISTS cause_nodes (case_id TEXT REFERENCES incidents(id) ON DELETE CASCADE,branch INTEGER,depth INTEGER,category TEXT,label TEXT, PRIMARY KEY(case_id,branch,depth));
        CREATE TABLE IF NOT EXISTS rca_reports (case_id TEXT PRIMARY KEY REFERENCES incidents(id) ON DELETE CASCADE,payload TEXT NOT NULL);
        """)
        if "resolution_json" not in {r[1] for r in c.execute("PRAGMA table_info(incidents)")}:
            c.execute("ALTER TABLE incidents ADD COLUMN resolution_json TEXT")


def write_case(c, owner, inp, chunks, report, status, case_id=None, sample=False, moment=None):
    updated = moment or now()
    existing = None
    if case_id:
        existing = c.execute(
            "SELECT * FROM incidents WHERE owner=? AND id=?", (owner, case_id)
        ).fetchone()
        if not existing:
            raise KeyError(case_id)
    else:
        case_id = str(uuid4())
    if existing:
        c.execute(
            "UPDATE incidents SET resolution_json=NULL,title=?,description=?,domain=?,severity=?,system=?,timeline=?,status=?,updated_at=? WHERE id=? AND owner=?",
            (
                inp.title,
                inp.description,
                inp.domain,
                inp.severity,
                inp.system,
                inp.timeline,
                status,
                updated,
                case_id,
                owner,
            ),
        )
        for table in ["evidence_docs", "cause_nodes", "rca_reports"]:
            c.execute(f"DELETE FROM {table} WHERE case_id=?", (case_id,))
    else:
        number = c.execute(
            "SELECT COALESCE(MAX(number),0)+1 FROM incidents WHERE owner=?", (owner,)
        ).fetchone()[0]
        c.execute(
            "INSERT INTO incidents(id,owner,number,title,description,domain,severity,system,timeline,status,sample,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                case_id,
                owner,
                number,
                inp.title,
                inp.description,
                inp.domain,
                inp.severity,
                inp.system,
                inp.timeline,
                status,
                int(sample),
                updated,
                updated,
            ),
        )
    c.executemany(
        "INSERT INTO evidence_docs VALUES(?,?,?,?)",
        [(case_id, i, d.name, d.text) for i, d in enumerate(inp.evidence)],
    )
    c.executemany(
        "INSERT INTO document_chunks VALUES(?,?,?,?,?)",
        [
            (
                case_id,
                h["doc"],
                h["index"],
                h["text"],
                json.dumps(h["embedding"], separators=(",", ":")),
            )
            for h in chunks
        ],
    )
    if report:
        c.execute(
            "INSERT INTO rca_reports VALUES(?,?)", (case_id, json.dumps(report, ensure_ascii=False))
        )
        nodes = [
            (case_id, i, depth, f["category"], text)
            for i, f in enumerate(report["causes"])
            for depth, text in enumerate([f["title"]] + [w["text"] for w in f["why"]])
        ]
        c.executemany("INSERT INTO cause_nodes VALUES(?,?,?,?,?)", nodes)
    return case_id


def workspace(owner):
    with db() as c:
        if c.execute("SELECT 1 FROM workspaces WHERE owner=?", (owner,)).fetchone():
            return
        c.execute("BEGIN IMMEDIATE")
        if not c.execute("INSERT OR IGNORE INTO workspaces VALUES(?,?)", (owner, now())).rowcount:
            return
        for i, row in reversed(list(enumerate(CASES))):
            title, domain, severity, system, description, status, docs = row
            inp = IncidentInput(
                title=title,
                domain=domain,
                description=description,
                severity=severity,
                system=system,
                evidence=[{"name": n, "text": t} for n, t in docs],
            )
            chunks = chunks_for([d.model_dump() for d in inp.evidence])
            moment = (
                datetime.now(timezone.utc) - timedelta(hours=[1, 6, 23, 32, 52, 77, 119, 144][i])
            ).isoformat()
            report = analyze(inp, chunks, []) if status != "Draft" else None
            if report:
                report["generated_at"] = moment
            iid = write_case(c, owner, inp, chunks, report, status, sample=True, moment=moment)
            if status == "Resolved":
                verification = {
                    "Thermal throttling on edge node": "After the approved fan replacement, temperatures and clock rate stayed stable over the same workload.",
                    "Worker memory growth": "A bounded cache kept retained heap stable across ten repeated identical import jobs.",
                    "Release configuration drift": "The canary started with the validated profile, and the previously failing startup check passed.",
                }
                record = {
                    "cause": report["causes"][0]["title"],
                    "note": verification[title],
                    "at": moment,
                }
                c.execute(
                    "UPDATE incidents SET resolution_json=? WHERE id=?", (json.dumps(record), iid)
                )


def as_case(row):
    d = dict(row)
    d.pop("owner", None)
    if "resolution_json" in d:
        d["resolution"] = json.loads(d.pop("resolution_json") or "null")
    d["sample"] = bool(d["sample"])
    d["ref"] = f"INV-{d.pop('number'):04d}"
    return d


def listing(owner):
    with db() as c:
        c.execute("BEGIN")  # coherent metadata snapshot without loading source text or reports
        rows = c.execute(
            "SELECT id,number,title,domain,severity,system,status,sample,created_at,updated_at FROM incidents WHERE owner=? ORDER BY updated_at DESC",
            (owner,),
        ).fetchall()
        docs = c.execute(
            "SELECT e.case_id,e.seq,e.name,length(CAST(e.content AS BLOB)) bytes FROM evidence_docs e JOIN incidents i ON i.id=e.case_id WHERE i.owner=? ORDER BY e.seq",
            (owner,),
        ).fetchall()
        files = {}
        for d in docs:
            files.setdefault(d["case_id"], []).append(
                {"name": d["name"], "bytes": d["bytes"], "index": d["seq"]}
            )
        return [dict(as_case(r), files=files.get(r["id"], [])) for r in rows]


def detail(owner, id, with_vectors=False):
    with db() as c:
        c.execute("BEGIN")  # an export must not mix two concurrent revisions
        row = c.execute("SELECT * FROM incidents WHERE id=? AND owner=?", (id, owner)).fetchone()
        if not row:
            raise KeyError(id)
        result = as_case(row)
        result["evidence"] = [
            dict(r)
            for r in c.execute(
                "SELECT name,content text FROM evidence_docs WHERE case_id=? ORDER BY seq", (id,)
            )
        ]
        if with_vectors:
            for d in result["evidence"]:
                d["chunks"] = []
            for r in c.execute(
                "SELECT * FROM document_chunks WHERE case_id=? ORDER BY doc,seq", (id,)
            ):
                result["evidence"][r["doc"]]["chunks"].append(
                    {"text": r["content"], "embedding": json.loads(r["embedding"])}
                )
        report = c.execute("SELECT payload FROM rca_reports WHERE case_id=?", (id,)).fetchone()
        result["report"] = json.loads(report[0]) if report else None
        return result


def save(owner, inp, case_id=None):
    sample = detail(owner, case_id)["sample"] if case_id else False
    hist = {}
    # Starter examples never inflate ranking on a real investigation.
    with db() as c:
        for r in c.execute(
            "SELECT id,title,resolution_json FROM incidents WHERE owner=? AND domain=? AND id!=? AND sample=? AND status=? AND resolution_json IS NOT NULL",
            (owner, inp.domain, case_id or "", int(sample), "Resolved"),
        ):
            hist[r["id"]] = {
                "title": r["title"],
                "causes": [json.loads(r["resolution_json"])["cause"]],
            }
    chunks = chunks_for([d.model_dump() for d in inp.evidence])
    report = analyze(inp, chunks, list(hist.values())) if inp.run else None
    with db() as c:
        c.execute("BEGIN IMMEDIATE")
        id = write_case(c, owner, inp, chunks, report, "In review" if report else "Draft", case_id)
    return detail(owner, id)
