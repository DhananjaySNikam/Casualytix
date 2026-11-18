# Causalytix — Project Report Phase-I (LaTeX) — NCER 2025-26

This directory contains the **print-ready LaTeX source** for the Phase-I project report, built exactly per the two attached PDFs:

* `Project Report Guidelines  2025-26.pdf` — A4, Times 12pt, Heading 16 Bold / Subheading 14 Bold, 1.5 spacing, margins L1.5" R1" T1" B1", page numbers right-bottom, header right = Project Title, footer left = Dept of CSE NCER + right page number, LaTeX format.
* `Project Phase I Index Format.pdf` — Index, List of Figures, List of Tables, List of Abbreviations.

> **College identity preserved verbatim:** NUTAN MAHARASHTRA VIDYA PRASARAK MANDAL'S NUTAN COLLEGE OF ENGINEERING & RESEARCH (NCER), Department of Computer Science and Engineering, Talegaon Dabhade, Pune — HOD Dr. Mahesh Wankhade, Coordinator Prof. S. B. Mehta. Author/PRN/Mentor fields are intentionally left blank (`\blankline`) for later hand-insertion as instructed.

## What is inside

```
report/
├── main.tex            — single-file report (front matter + 4 chapters + annexure)
├── references.bib      — 40 peer-reviewed papers (2020-2024) — all cited
├── images/
│   ├── 01-context.pdf  … 11-deployment.pdf   (placeholder diagram PDFs)
│   ├── 01-context.svg  … 11-deployment.svg   (original Atlas SVGs copied from public/assets/atlas/)
│   ├── *.mmd                                   (Mermaid sources)
│   └── causalytix-diagram-atlas.pdf           (12-page printable atlas)
├── ncer-logo.pdf       — placeholder for college logo (replace with actual logo)
├── Makefile
└── README.md
```

### Chapters implemented

| Index item | LaTeX | Content |
|---|---|---|
| Certificate / Declaration / Acknowledgement / Abstract / TOC / LOF / LOT / LOA | `roman` front matter | Front matter per university norm; TOC auto-generated |
| **Ch. 1 Introduction** | Ch. 1 | 1.1 Introduction, 1.2 Necessity, 1.3 Problem Statement, 1.4 Motivation, 1.5 Objectives O1–O8 |
| **Ch. 2 Literature Survey** | Ch. 2 | Thematic survey of 40 papers + **Table 2.1** 40-row summary (landscape longtable) + research gap |
| **Ch. 3 Proposed System** | Ch. 3 | 3.1 Technology We Used (Table 3.1), 3.2 System Overview (context/components/ERD/deployment figs), 3.3 Process (9-stage workflow + evidence flow + sequence + lifecycle), 3.4 Block Diagram & diagnostic-method visuals (Ishikawa, 5-Why, ranking, atlas mapping) |
| **Ch. 4 Conclusions** | Ch. 4 | Summary, Limitations, Future Scope |
| **References** | `IEEEtran` | IEEE numbered, 40 entries |
| **ANNEXURE A** | Annexure | I. Paper Published / Acceptance (blank), II. IPR (blank, LICENSE MIT + OFL notes) |

All figures are captioned, labelled, cross-referenced (`\ref{fig:context}` etc.) and listed in **List of Figures**. Tables use `booktabs` and are in **List of Tables**.

## Formatting compliance checklist

- [x] `geometry` — L1.5" R1" T1" B1", `headheight`/`footskip` set
- [x] `times` + `newtxtext/newtxmath` — Times New Roman clone, `fontenc T1`
- [x] `titlesec` — Chapter 16pt Bold, Section 14pt Bold, Subsection 13pt Bold
- [x] `setspace` — `\onehalfspacing` (1.5×)
- [x] `fancyhdr` — Header right = *Causalytix — From Symptom to Cause*, Footer left = Dept line, Footer right = page number (`plain` style too)
- [x] Page numbers: `roman` front matter → `arabic` from Ch. 1, continuous
- [x] Hyperlinks via `hyperref` (hidelinks)
- [x] Bibliography via `natbib` numeric, `\bibliographystyle{IEEEtran}` + `references.bib`

## How to compile

### Prerequisites

Install a full TeX Live (recommended) or MiKTeX:

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install texlive-latex-recommended texlive-latex-extra texlive-fonts-recommended texlive-bibtex-extra latexmk

# macOS (MacTeX)
brew install --cask mactex
```

### Build

```bash
cd report

# Option A: latexmk (recommended)
latexmk -pdf main.tex
# or for continuous preview:
latexmk -pvc -pdf main.tex

# Option B: manual sequence
pdflatex main.tex
bibtex main
pdflatex main.tex
pdflatex main.tex

# Clean
latexmk -C
```

Output: `main.pdf` (~40-50 pages with front matter, depending on figure sizes).

### Logo replacement

Replace the placeholder on the title page:

```latex
\includegraphics[width=0.18\textwidth]{example-image}
```

with:

```latex
\includegraphics[width=0.18\textwidth]{ncer-logo.pdf}
```

Place your `ncer-logo.pdf` (or `.png`) in `report/images/` or `report/`.

### Diagram replacement for final print

The included `images/01-context.pdf` … `11-deployment.pdf` are intentional placeholders (header + box) that preserve layout without requiring Inkscape. For submission, replace them with high-resolution exports:

```bash
# If you have Inkscape:
for f in images/*.svg; do inkscape "$f" --export-filename="${f%.svg}.pdf"; done

# Or export each Mermaid via mermaid-cli:
mmdc -i public/assets/atlas/01-context.mmd -o report/images/01-context.pdf
```

The printable combined atlas (`images/causalytix-diagram-atlas.pdf`) can be attached as an appendix if allowed.

## Bibliography — 40 papers

All 40 entries in `references.bib` are cited at least once (Table 2.1 + narrative). They span:

* RCA surveys & causal foundations (Wang 2024, Soldani 2022, Ma 2020, Pham 2024 …)
* Log/trace/metric RCA (DeepLog 2017, LogAnomaly 2021, Nezha, CHASE, HeMiRCA, TraceDiag, Microscope …)
* RAG + LLM for incidents (RCACopilot EuroSys 2024, X-lifecycle FSE 2024, Xpert ICSE 2024, LLexus SIGOPS 2024, RAG survey Lewis 2020 / Gao 2023 / Zhao 2024 …)
* Retrieval foundations (BM25 2009, FiD 2021, Sentence-BERT 2019 …)
* Quality engineering (Ishikawa 1986, Ohno 1988, Ciecińska 2023, Card 2017, Doggett 2005 …)
* Hardware predictive maintenance (Jardim 2019, Angelopoulos 2022, Ran 2021, Susto 2015, Zhang 2018/2022 …)
* SE for ML (Amershi 2019)

To change style, edit near EOF: `\bibliographystyle{IEEEtran}` → `unsrtnat`/`plainnat`/`abbrvnat`.

## Filling blanks before submission

Search for `\blankline` in `main.tex` — every occurrence is a field to be completed by hand or by replacing with text:

* Title page: 4 students × name + PRN
* Guide name (Certificate, Declaration, Acknowledgement)
* Date/Place (Certificate)
* ANNEXURE A tables (paste acceptance letter / IPR receipt)

No college name, HOD name or coordinator name has been altered.

## License

Report template & content: MIT (same as repository `LICENSE`). Third-party fonts/assets: see `public/assets/licenses/` (OFL, MIT).

---
*Generated for arena/8a146b23-casualytix — based on Casualytix v1.0 codebase + System Design Spec v1.0. For questions, open an issue at github.com/DhananjaySNikam/Casualytix.*
