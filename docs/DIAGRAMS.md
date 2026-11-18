# Causalytix · Project report diagram atlas

The immutable illustrations here document the system; each incident generates its own evidence-linked cause map and 5-Why chain.

[Notion edition](https://app.notion.com/p/CAUSALYTIX-Project-Report-Diagram-Atlas-41c3502181d78100893ddb122e49401a)

[Download all 11 figures as a printable PDF](../public/assets/causalytix-diagram-atlas.pdf). Each figure also has an SVG and Mermaid source under `public/assets/atlas/`.

## 01 / System context

The investigator supplies a brief and evidence, then reviews hypotheses before applying a fix.

```mermaid
flowchart LR
 E[Investigator] --> I[Incident brief]
 E --> D[Evidence and design notes]
 I --> C[Causalytix workspace]
 D --> C
 C --> H[Ranked hypotheses]
 H --> V[Human verification]
 C --> R[PDF and JSON reports]
 C --> A[Optional cloud archive]
```

## 02 / Component architecture

The FastAPI gateway coordinates retrieval, inference and persistence; React renders the workspace.

```mermaid
flowchart TB
 UI[React workspace] -->|Same-origin REST| API[FastAPI gateway]
 API --> IN[Input validation]
 IN --> RET[Passage retrieval]
 RET --> E[Diagnostic engine]
 E --> L[Local classifier]
 E --> M[Optional language model]
 L --> R[Evidence matching and ranking]
 M --> R
 R --> DB[(SQLite)]
 DB --> O[Diagrams and reports]
 UI -->|Explicit archive| A[Supabase Auth]
 A --> PG[(Postgres and pgvector)]
```

## 03 / Investigation workflow

The nine stages of a complete investigation, including the draft path and evidence-gap feedback loop.

```mermaid
flowchart LR
 subgraph Intake
 A[01 · Problem input] --> B[02 · Evidence intake]
 end
 subgraph Reasoning
 C[03 · Generate causes] --> D[04 · Ishikawa map] --> E[05 · Five Whys]
 end
 subgraph Validation
 F[06 · Match evidence] --> G[07 · Rank causes]
 end
 subgraph Resolution
 H[08 · Corrective actions] --> I[09 · RCA report]
 end
 B --> C
 E --> F
 G --> H
 B -. Save for later .-> J[Draft]
 F -. Evidence gap .-> B
```

## 04 / Evidence data flow

A source reference records a document, passage number and original excerpt. Weak matches become explicit gaps.

```mermaid
flowchart TB
 A[File upload] --> V[Validate and extract text]
 B[Pasted observation] --> D[Evidence document]
 V --> D
 D --> C[Overlapping passages]
 C --> H[256-D vectors]
 H --> I[(Passage index)]
 Q[Cause or Why statement] --> M[Cosine matching]
 I --> M
 M -->|Related| S[Source and excerpt]
 M -->|Weak or absent| G[Evidence gap]
```

## 05 / Analysis sequence

Two model passes or the offline classifier produce candidates. The gateway computes scores independently.

```mermaid
sequenceDiagram
 actor E as Engineer
 participant U as React
 participant A as FastAPI
 participant I as Inference
 participant D as SQLite
 E->>U: Provide brief and evidence
 U->>A: Analyze incident
 A->>D: Read related resolved cases
 A->>I: Incident and retrieved passages
 alt Language model selected
 I->>I: Propose candidates
 I->>I: Expand five links and actions
 else Offline or provider failure
 I->>I: Classify and select playbooks
 end
 I-->>A: Typed findings and provenance
 A->>A: Match sources and rank
 A->>D: Commit investigation
 A-->>U: Render report and maps
```

## 06 / Entity relationships

The same logical entities are kept locally and in Supabase. Cloud keys include the authenticated owner.

```mermaid
erDiagram
 WORKSPACE ||--o{ INCIDENT : owns
 INCIDENT ||--o{ EVIDENCE_DOC : contains
 EVIDENCE_DOC ||--o{ DOCUMENT_CHUNK : splits_into
 INCIDENT ||--o{ CAUSE_NODE : proposes
 INCIDENT ||--o| RCA_REPORT : produces
 INCIDENT {
  uuid id PK
  string title
  string domain
  string status
 }
 EVIDENCE_DOC {
  int seq
  string name
  text content
 }
 DOCUMENT_CHUNK {
  int seq
  text content
  vector embedding
 }
 CAUSE_NODE {
  int branch
  int depth
  string category
  string label
 }
 RCA_REPORT {
  json payload
 }
```

## 07 / Ishikawa mapping

Illustrative candidate branches, not confirmed causes. Each analyzed case has its own interactive fishbone.

```mermaid
flowchart LR
 A[Pool saturation] --> I[Infrastructure]
 B[Incompatible release setting] --> C[Configuration]
 D[Unstable upstream route] --> N[Network]
 I --> E[Gateway latency spike]
 C --> E
 N --> E
```

## 08 / 5-Why expansion

Each step is a testable hypothesis with its own related passage or evidence-gap flag.

```mermaid
flowchart TD
 S[Slow requests] --> A[1 · Waiting for a session]
 A --> B[2 · Sessions occupied]
 B --> C[3 · Long running transactions]
 C --> D[4 · Pool budget and concurrency mismatch]
 D --> E[5 · Missing peak workload tests]
 L[Pool telemetry] -. Compare .-> B
 E --> V[Verify with a controlled workload]
```

## 09 / Root cause ranking

The weighted sum ranks candidates, not the probability of a failure. A human verifies the proposed action.

```mermaid
flowchart LR
 E[Evidence match] -->|50 percent| S[Weighted sum]
 I[Severity impact] -->|30 percent| S
 F[Historical frequency] -->|20 percent| S
 S --> R[Rank score out of 100]
 R --> T[Verification test]
 T -->|Confirmed| A[Corrective action]
 T -->|Unclear| G[Collect more evidence]
```

## 10 / Case lifecycle

Drafts can be analyzed, reviewed, resolved, and reopened without losing source evidence.

```mermaid
stateDiagram-v2
 state "In review" as Review
 [*] --> Draft: Save brief
 [*] --> Review: Run analysis
 Draft --> Review: Analyze
 Review --> Draft: Edit and save draft
 Review --> Review: Add evidence and reanalyze
 Review --> Resolved: Verify and resolve
 Resolved --> Review: Reopen
```

## 11 / Deployment boundaries

The local application runs without cloud credentials. Model inference and cloud archival are separate opt-in paths.

```mermaid
flowchart TB
 subgraph Browser
 UI[React client]
 SA[Supabase client]
 end
 subgraph Host[Application host]
 UV[Uvicorn and FastAPI]
 EN[Retrieval and inference]
 SQ[(SQLite volume)]
 UV --> EN --> SQ
 end
 UI -->|Same origin| UV
 EN -. Optional .-> M[Model endpoint]
 UI -->|Explicit archive| SA
 SA -->|User JWT| SB[Supabase Auth and REST]
 SB -->|Owner policy| PG[(Postgres and pgvector)]
```
