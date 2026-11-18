"""Portable, paginated report with vector fishbone and source references."""

from io import BytesIO
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.graphics.shapes import Drawing, Line, String, Circle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, KeepTogether


def report_pdf(case):
    out = BytesIO()
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=42,
        rightMargin=42,
        topMargin=58,
        bottomMargin=45,
        title=case["title"],
        author="Causalytix",
    )
    styles = getSampleStyleSheet()
    styles["Heading2"].textColor = colors.HexColor("#117664")
    story = []

    def p(text, style="BodyText"):
        return Paragraph(escape(str(text)).replace("\n", "<br/>"), styles[style])

    def add(text, style="BodyText"):
        story.append(p(text, style))

    report = case["report"]
    add("ROOT CAUSE ANALYSIS  /  " + case["ref"], "Heading3")
    add(case["title"], "Title")
    add(
        "  |  ".join(
            [
                case["domain"],
                case["severity"] + " impact",
                case["status"],
                report["generated_at"][:10],
            ]
        )
    )
    add("Analysis engine: " + report["engine"])
    add("Illustrative starter case." if case["sample"] else "Investigator-supplied incident.")
    add("Incident brief", "Heading2")
    add(case["description"])
    add("Affected system: " + (case["system"] or "Not specified"))
    add("Timeline: " + (case["timeline"] or "Not specified"))
    add("Executive summary", "Heading2")
    add(report["summary"])
    add(report["engine_note"])
    add("Ishikawa map", "Heading2")
    d = Drawing(495, 110)
    c = colors.HexColor("#147e71")
    d.add(Line(8, 50, 457, 50, strokeColor=c, strokeWidth=2))
    d.add(String(460, 47, "Effect", fontSize=9))
    n = len(report["causes"])
    for i, f in enumerate(report["causes"]):
        x = 20 + i * (402 / max(1, n))
        y = 94 if i % 2 == 0 else 8
        d.add(Line(x + 6, y, x + 46, 50, strokeColor=c))
        d.add(Circle(x + 46, 50, 2.5, fillColor=c, strokeColor=c))
        d.add(String(x + 9, y + 2, f"{i + 1}. " + f["category"][:23], fontSize=8))
    story.append(d)
    add(
        "Relative rank = 50% evidence similarity + 30% severity impact + 20% historical frequency. Not a calibrated probability or proof of causation."
    )
    for i, f in enumerate(report["causes"], 1):
        story.extend(
            [
                Spacer(1, 9),
                KeepTogether(
                    [
                        p(f"{i:02d} / {f['title']}", "Heading2"),
                        p(f"{f['category']}  |  Rank score {f['score']}/100"),
                    ]
                ),
            ]
        )
        ref = f["source"]
        add(
            f"Related evidence: {ref['name']}, passage {ref['chunk']} — {ref['excerpt'][:800]}"
            if ref
            else "Evidence gap: no sufficiently similar passage."
        )
        add("5-Why chain", "Heading3")
        for j, w in enumerate(f["why"], 1):
            r = w["source"]
            add(
                f"Why {j}. {w['text']}  [{r['name'] + ' #' + str(r['chunk']) if r else 'Needs evidence'}]"
            )
        for k, label in [
            ("contain", "Immediate containment"),
            ("prevent", "Preventive change"),
            ("verify", "Verification test"),
        ]:
            add(label, "Heading3")
            add(f[k])
    if case.get("resolution"):
        add("Engineer verification", "Heading2")
        add(case["resolution"]["cause"], "Heading3")
        add(case["resolution"]["note"])
        add("Recorded: " + case["resolution"]["at"][:10])
    add("Evidence register", "Heading2")
    for i, e in enumerate(case["evidence"], 1):
        add(f"E{i:02d}  {e['name']}  ({len(e['text'])} characters)")
    if not case["evidence"]:
        add("No evidence attached.")

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#0e2927"))
        canvas.rect(0, A4[1] - 35, A4[0], 35, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont("Helvetica-Bold", 10)
        canvas.drawString(42, A4[1] - 22, "CAUSALYTIX  /  ENGINEERING INTELLIGENCE")
        canvas.setFillColor(colors.grey)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(42, 23, case["ref"] + "   •   Investigator review required")
        canvas.drawRightString(A4[0] - 42, 23, f"{doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return out.getvalue()
