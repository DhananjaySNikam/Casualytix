import math
import os
import unittest
from unittest.mock import patch
from backend.engine import DIM, analyze, chunks_for, cosine, support, vector
from backend.models import IncidentInput


def incident(**overrides):
    data = dict(
        title="Controller brownout resets",
        description="Every voltage drop under load produces a reset. The adapter may hit its current limit.",
        domain="Hardware",
        severity="High",
        evidence=[
            {
                "name": "supply.log",
                "text": "power supply voltage drops under transient load; undervoltage fault resets controller",
            }
        ],
    )
    data.update(overrides)
    return IncidentInput(**data)


def evaluate(c, history=None):
    return analyze(c, chunks_for([d.model_dump() for d in c.evidence]), history or [])


class EngineTests(unittest.TestCase):
    def test_vector_is_stable_normalized_and_alias_aware(self):
        v = vector("database pool timeout")
        self.assertEqual(len(v), DIM)
        self.assertAlmostEqual(math.sqrt(sum(x * x for x in v)), 1, places=5)
        self.assertGreater(cosine(v, vector("postgres pool timeouts")), 0.99)
        self.assertEqual(vector(""), [0.0] * DIM)

    def test_multichunk_citation_is_original_text(self):
        text = (
            "Neutral passage. " * 50
            + "power supply voltage drop undervoltage reset under load. " * 7
        )
        chunks = chunks_for([{"name": "measurements.txt", "text": text}])
        score, ref = support("voltage drop load undervoltage reset", chunks)
        self.assertGreater(score, 0.2)
        self.assertEqual(ref["chunk"], 2)
        self.assertIn(ref["excerpt"], text)
        self.assertEqual(ref["doc"], 0)

    def test_domain_and_evidence_drive_mechanism(self):
        r = evaluate(incident())
        f = r["causes"][0]
        self.assertEqual(f["title"], "Unstable power delivery")
        self.assertEqual(f["source"]["name"], "supply.log")
        self.assertEqual(len(f["why"]), 5)
        self.assertTrue(all(f[k] for k in ["contain", "prevent", "verify"]))
        sw = evaluate(
            incident(
                title="Worker memory leak",
                description="Worker killed due to OOM after cached objects grow on every job.",
                domain="Software",
                evidence=[
                    {
                        "name": "heap.txt",
                        "text": "Worker killed out of memory OOM; retained heap and cached objects grow.",
                    }
                ],
            )
        )
        self.assertIn("memory", sw["causes"][0]["title"].lower())
        self.assertNotEqual(sw["causes"][0]["prevent"], f["prevent"])

    def test_weighted_rank_and_prior_saturation(self):
        f = evaluate(
            incident(), [{"title": "Earlier reset", "causes": ["Unstable power delivery"]}] * 5
        )["causes"][0]
        factors = f["factors"]
        self.assertEqual(factors["frequency"], 1)
        self.assertEqual(factors["prior_cases"], 5)
        self.assertEqual(
            f["score"],
            round(50 * factors["evidence"] + 30 * factors["impact"] + 20 * factors["frequency"]),
        )

    def test_no_evidence_is_not_confirmation(self):
        r = evaluate(incident(evidence=[]))
        self.assertTrue(
            all(f["source"] is None and f["factors"]["evidence"] == 0 for f in r["causes"])
        )
        self.assertTrue(all(w["source"] is None for f in r["causes"] for w in f["why"]))

    def test_classifier_abstains_out_of_domain(self):
        r = evaluate(
            incident(
                title="Unclassified observation",
                description="Something unexpected happened yesterday.",
                evidence=[],
            )
        )
        self.assertIn("not yet isolated", r["causes"][0]["title"])

    def test_two_pass_model_results_are_ranked_locally(self):
        roots = {"causes": [{"title": "Supply voltage drop", "category": "Machine", "impact": 0.8}]}
        details = {
            "findings": [
                {
                    "why": ["Supply may sag at peak load."] * 5,
                    "contain": "Use a known-good approved adapter.",
                    "prevent": "Check the rated margin.",
                    "verify": "Compare before and after telemetry.",
                }
            ]
        }
        with (
            patch.dict(
                os.environ, {"LLM_BASE_URL": "http://model.invalid/v1", "LLM_MODEL": "test-model"}
            ),
            patch("backend.engine.completion", side_effect=[roots, details]) as completion,
        ):
            r = evaluate(incident(engine="llm"))
            self.assertEqual(completion.call_count, 2)
            self.assertEqual(r["engine"], "test-model")
            self.assertEqual(r["causes"][0]["factors"]["impact"], 0.8)
            self.assertEqual(r["causes"][0]["source"]["name"], "supply.log")

    def test_invalid_provider_output_falls_back_with_provenance(self):
        with (
            patch.dict(os.environ, {"OPENAI_API_KEY": "test-only"}),
            patch("backend.engine.completion", return_value={"unrelated": True}),
        ):
            r = evaluate(incident(engine="llm"))
            self.assertEqual(r["engine"], "Local classifier")
            self.assertIn("invalid report", r["engine_note"])
