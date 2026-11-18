import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from pypdf import PdfReader

_root = tempfile.TemporaryDirectory()
os.environ["CAUSALYTIX_DATA"] = _root.name
from backend.app import app
from backend import store
from reportlab.pdfgen import canvas

MUTATE = {"X-Causalytix-Client": "workspace"}
DATA = {
    "title": "Checkout pool saturation",
    "description": "Requests wait for all occupied database connections until the pool acquire timeout.",
    "domain": "Software",
    "severity": "High",
    "evidence": [
        {
            "name": "pool.log",
            "text": "Connection pool exhaustion: long database transactions waited for available sessions; acquire timeout.",
        }
    ],
}


def tearDownModule():
    _root.cleanup()


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = patch.object(store, "DB", Path(self.tmp.name) / "case.sqlite3")
        self.path.start()
        self.client = TestClient(app)
        self.client.__enter__()
        self.client.headers.update(MUTATE)
        self.ws = self.client.get("/api/workspace").json()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.path.stop()
        self.tmp.cleanup()

    def create(self, **k):
        r = self.client.post("/api/investigations", json={**DATA, **k})
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def test_workspace_persistence_and_samples(self):
        self.assertTrue(self.ws["cases"])
        self.assertTrue(all(c["sample"] for c in self.ws["cases"]))
        c = self.create()
        self.assertFalse(c["sample"])
        self.assertTrue(all(x["factors"]["prior_cases"] == 0 for x in c["report"]["causes"]))
        with TestClient(app) as other:
            other.cookies.update(self.client.cookies)
            self.assertEqual(
                other.get("/api/investigations/" + c["id"]).json()["report"], c["report"]
            )

    def test_draft_to_review_to_verified_resolution(self):
        draft = self.create(run=False)
        path = "/api/investigations/" + draft["id"]
        self.assertIsNone(draft["report"])
        self.assertEqual(draft["status"], "Draft")
        self.assertEqual(self.client.get(path + "/export/pdf").status_code, 409)
        self.assertEqual(
            self.client.patch(path + "/status", json={"status": "Resolved"}).status_code, 409
        )
        r = self.client.put(path, json=DATA).json()
        self.assertEqual(r["status"], "In review")
        self.assertEqual(
            self.client.patch(path + "/status", json={"status": "Resolved"}).status_code, 422
        )
        done = self.client.patch(
            path + "/status",
            json={
                "status": "Resolved",
                "cause_index": 0,
                "note": "Pool wait returned to its baseline under matched traffic.",
            },
        ).json()
        self.assertEqual(done["status"], "Resolved")
        self.assertEqual(done["resolution"]["cause"], r["report"]["causes"][0]["title"])
        again = self.create()
        self.assertEqual(again["report"]["causes"][0]["factors"]["prior_cases"], 1)
        reopened = self.client.patch(path + "/status", json={"status": "In review"}).json()
        self.assertEqual(reopened["status"], "In review")
        self.assertIsNone(reopened["resolution"])
        self.assertEqual(reopened["report"], r["report"])

    def test_exports_and_normalized_snapshot(self):
        c = self.create()
        p = "/api/investigations/" + c["id"]
        self.assertEqual(self.client.get(p + "/export/json").json()["report"], c["report"])
        res = self.client.get(p + "/export/pdf")
        self.assertEqual(res.headers["content-type"], "application/pdf")
        pdf = PdfReader(io.BytesIO(res.content))
        text = "\n".join(x.extract_text() for x in pdf.pages)
        self.assertIn("Checkout pool saturation", text)
        self.assertIn("Verification test", text)
        self.assertIn("Ishikawa map", text)
        cloud = self.client.get(p + "/snapshot").json()
        self.assertNotIn("owner", cloud)
        self.assertEqual(len(cloud["evidence"][0]["chunks"][0]["embedding"]), 256)
        with store.db() as conn:
            self.assertEqual(
                conn.execute(
                    "select count(*) from cause_nodes where case_id=?", (c["id"],)
                ).fetchone()[0],
                6 * len(c["report"]["causes"]),
            )

    def test_separate_workspace_cannot_read_or_change_case(self):
        c = self.create()
        u = "/api/investigations/" + c["id"]
        with TestClient(app) as other:
            self.assertEqual(other.get(u).status_code, 401)
            other.get("/api/workspace")
            for ending in ["", "/snapshot", "/export/json", "/export/pdf"]:
                self.assertEqual(other.get(u + ending).status_code, 404)
            self.assertEqual(other.put(u, json=DATA, headers=MUTATE).status_code, 404)
            self.assertEqual(
                other.patch(
                    u + "/status", json={"status": "In review"}, headers=MUTATE
                ).status_code,
                404,
            )

    def test_evidence_text_and_pdf_parsing(self):
        for name, raw in [("trace.log", b"warning: timeout"), ("notes.md", b"# Design note")]:
            d = self.client.post("/api/evidence/parse", files={"file": (name, raw)}).json()
            self.assertEqual(d, {"name": name, "text": raw.decode()})
        buf = io.BytesIO()
        pdf = canvas.Canvas(buf)
        pdf.drawString(20, 750, "Measured voltage drop")
        pdf.save()
        r = self.client.post(
            "/api/evidence/parse", files={"file": ("design.pdf", buf.getvalue(), "application/pdf")}
        )
        self.assertIn("Measured voltage drop", r.json()["text"])
        for name, data, code in [
            ("binary.bin", b"data", 415),
            ("broken.pdf", b"not pdf", 422),
            ("empty.txt", b" ", 422),
            ("oversize.log", b"x" * 2000001, 413),
        ]:
            self.assertEqual(
                self.client.post("/api/evidence/parse", files={"file": (name, data)}).status_code,
                code,
            )

    def test_input_boundaries(self):
        self.assertEqual(
            self.client.post("/api/investigations", json={**DATA, "title": "i"}).status_code, 422
        )
        self.assertEqual(
            self.client.post(
                "/api/investigations", json={**DATA, "evidence": DATA["evidence"] * 7}
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(
                "/api/investigations", json=DATA, headers={"X-Causalytix-Client": ""}
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/api/investigations", content=iter([b"x" * 1500001, b"y" * 1500001])
            ).status_code,
            413,
        )
        self.assertEqual(self.client.get("/api/health").json()["status"], "online")
