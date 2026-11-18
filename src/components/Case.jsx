import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  FileText,
  FileJson,
  FileDown,
  Download,
  Pencil,
  ScanLine,
  GitBranch,
  Waypoints,
  Paperclip,
  Lightbulb,
  CloudUpload,
  ShieldCheck,
  FlaskConical,
  Activity,
  ChevronDown,
  Info,
  RotateCcw,
  FileSearch,
  ArrowUpRight,
} from 'lucide-react';
import { api, go, count, dt } from '../api';
import { Badge, Empty, ErrorBox, Loading, Modal } from './Ui';
import { archiveCase, cloudSession } from '../cloud';
const tabs = [
  ['summary', 'Findings', ScanLine],
  ['map', 'Causal map', Waypoints],
  ['whys', '5-Why chain', GitBranch],
  ['actions', 'Solutions', Lightbulb],
  ['evidence', 'Evidence', Paperclip],
];
const palette = ['#50dfc1', '#b19bf4', '#6ab9ed', '#e4ae65'];
function wrap(s, n, max = 3) {
  const words = s.split(' '),
    lines = [''];
  for (const w of words) {
    if ((lines.at(-1) + ' ' + w).trim().length > n && lines.at(-1)) lines.push(w);
    else lines[lines.length - 1] = (lines.at(-1) + ' ' + w).trim();
  }
  return lines.slice(0, max).map((l, i) => (i === max - 1 && lines.length > max ? l + '…' : l));
}
export function Fishbone({ causes, title, selected, onSelect }) {
  const groups = Object.entries(
    causes.reduce((g, c, i) => {
      (g[c.category] ||= []).push(i);
      return g;
    }, {}),
  );
  const cols = Math.ceil(groups.length / 2);
  const h = 240;
  return (
    <div className="fish-scroll">
      <svg
        className="fishbone"
        viewBox={`0 0 800 ${h}`}
        role="group"
        aria-label="Interactive Ishikawa cause and effect diagram"
      >
        <defs>
          <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r=".8" fill="#324146" />
          </pattern>
        </defs>
        <rect width="800" height={h} fill="url(#dots)" />
        <path d="M23 120H589" stroke="#6b918b" strokeWidth="2" />
        <path d="m582 115 9 5-9 5" fill="none" stroke="#72c7b7" strokeWidth="2" />
        {groups.map(([cat, ids], i) => {
          const x = 54 + Math.floor(i / 2) * (510 / cols),
            up = i % 2 === 0,
            y = up ? 44 : 193,
            pivot = x + 92 + (up ? 0 : 30),
            color = palette[ids[0] % 4];
          return (
            <g key={cat} className="fish-group">
              <path d={`M${x + 14} ${y + 6}L${pivot} 120`} stroke={color} strokeWidth="1.7" />
              <circle cx={pivot} cy="120" r="4" fill={color} />
              <text x={x} y={up ? y - 14 : y + 27} fontSize="12" fontWeight="600" fill={color}>
                {cat}
              </text>
              {ids.map((idx, j) => (
                <g
                  role="button"
                  aria-label={'Select ' + causes[idx].title}
                  tabIndex="0"
                  key={idx}
                  onClick={() => onSelect(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(idx);
                    }
                  }}
                >
                  <rect
                    x={x + 2 + j * 49}
                    y={y - 5}
                    width="44"
                    height="20"
                    rx="3"
                    fill={idx === selected ? '#1c4140' : '#172228'}
                    stroke={color}
                  />
                  <text
                    x={x + 24 + j * 49}
                    y={y + 9}
                    textAnchor="middle"
                    fontSize="10"
                    fill={color}
                  >
                    C{count(idx + 1)}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
        <rect x="600" y="74" width="179" height="91" rx="6" fill="#14252a" stroke="#398a79" />
        <text x="614" y="95" fill="#6bdbc4" fontSize="9" letterSpacing="1.2">
          OBSERVED EFFECT
        </text>
        {wrap(title, 23).map((t, i) => (
          <text key={i} x="614" y={115 + i * 16} fill="#e3f3f0" fontSize="12">
            {t}
          </text>
        ))}
      </svg>
    </div>
  );
}
function Citation({ source, open }) {
  return source ? (
    <button className="citation" onClick={() => open(source)}>
      <FileSearch size={13} />
      {source.name} · §{source.chunk}
      <ArrowUpRight size={12} />
    </button>
  ) : (
    <span className="gap">
      <Info size={12} />
      Needs evidence
    </span>
  );
}
export default function Case({ id, tab = 'summary', docIndex, refresh, notify }) {
  const [c, setC] = useState(null),
    [error, setError] = useState(''),
    [modal, setModal] = useState(''),
    [source, setSource] = useState(null),
    [selected, setSelected] = useState(0),
    [busy, setBusy] = useState(false),
    [opError, setOpError] = useState(''),
    [causeIndex, setCauseIndex] = useState(0),
    [verification, setVerification] = useState('');
  useEffect(() => {
    let active = true;
    api('investigations/' + id)
      .then((d) => active && setC(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);
  const changeTab = (v) => go(`case/${id}/${v}`);
  const show = (m) => {
    setOpError('');
    if (m === 'status') {
      setCauseIndex(selected);
      setVerification('');
    }
    setModal(m);
  };
  async function status() {
    setBusy(true);
    setOpError('');
    try {
      const d = await api(`investigations/${id}/status`, {
        method: 'PATCH',
        body: {
          status: c.status === 'Resolved' ? 'In review' : 'Resolved',
          cause_index: causeIndex,
          note: verification,
        },
      });
      setC(d);
      await refresh();
      setModal('');
      notify('Investigation status updated.');
    } catch (e) {
      setOpError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    setBusy(true);
    setOpError('');
    try {
      if (!(await cloudSession())) {
        throw new Error(
          'Sign in to Supabase in System settings first. Your local case is unchanged.',
        );
      }
      await archiveCase(id);
      setModal('');
      notify('Investigation and evidence archived to Supabase.');
    } catch (e) {
      setOpError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!c) return <Loading text="Opening investigation…" />;
  const R = c.report,
    findings = R?.causes || [],
    f = findings[selected];
  const selectControl = (
    <label className="cause-select">
      <span className="eyebrow muted-text">CAUSE BRANCH</span>
      <select value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
        {findings.map((a, i) => (
          <option key={i} value={i}>
            C{count(i + 1)} · {a.title}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <button className="back-link" onClick={() => go('investigations')}>
        <ArrowLeft size={13} />
        Investigations
      </button>
      <header className="case-head">
        <div className="eyebrow">
          <span className="eyeline" />
          {c.ref}
          <span className="eyediv">/</span>
          {c.domain.toUpperCase()}
        </div>
        <div className="case-title">
          <h1>{c.title}</h1>
          <Badge status={c.status} />
        </div>
        <div className="case-meta">
          <span>{c.severity} impact</span>
          <i />
          {c.system || 'System not specified'}
          <i />
          {dt(c.created_at)}
          {c.sample && <span className="sample-label">Starter case</span>}
        </div>
        <div className="case-tools">
          <button
            className={'btn ' + (R ? 'secondary' : 'primary')}
            onClick={() => go('edit/' + id)}
          >
            {R ? <Pencil size={14} /> : <ScanLine size={15} />}{' '}
            {R ? 'Edit & reanalyze' : 'Complete investigation'}
          </button>
          {R && (
            <button className="btn secondary" onClick={() => show('export')}>
              <Download size={14} />
              Export report
            </button>
          )}
          <button className="btn subtle" onClick={() => show('cloud')}>
            <CloudUpload size={15} />
            Archive to cloud
          </button>
          {R && (
            <button className="text-link status-action" onClick={() => show('status')}>
              {c.status === 'Resolved' ? <RotateCcw size={14} /> : <CircleCheck size={14} />}{' '}
              {c.status === 'Resolved' ? 'Reopen case' : 'Mark resolved'}
            </button>
          )}
        </div>
      </header>
      <nav className="tabs" aria-label="Investigation views">
        {tabs
          .filter(([v]) => R || ['summary', 'evidence'].includes(v))
          .map(([v, n, I]) => (
            <button
              key={v}
              onClick={() => changeTab(v)}
              aria-current={v === tab ? 'page' : undefined}
              className={v === tab ? 'active' : ''}
            >
              <I size={15} />
              {n}
              {v === 'evidence' && <span>{c.evidence.length}</span>}
            </button>
          ))}
      </nav>
      {tab === 'summary' && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div className="panel-title">
                <FileText size={16} />
                <h2>Incident brief</h2>
              </div>
              <span className="mini-tag">INPUT</span>
            </div>
            <div className="panel-body">
              <p className="body-copy">{c.description}</p>
              {c.timeline && (
                <p className="timeline-note">
                  <b>Baseline & timeline</b>
                  {c.timeline}
                </p>
              )}
              {c.resolution && (
                <div className="verified-note">
                  <ShieldCheck size={17} />
                  <div>
                    <b>Verified cause · {c.resolution.cause}</b>
                    <p>{c.resolution.note}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
          {R ? (
            <>
              <div className="summary-box">
                <ScanLine size={21} />
                <div>
                  <div className="eyebrow">ANALYSIS SUMMARY</div>
                  <p>{R.summary}</p>
                  <small>
                    {R.engine} · {R.engine_note}
                  </small>
                </div>
              </div>
              <div className="subhead">
                <h2>Ranked hypotheses</h2>
                <span className="mini-tag">{count(findings.length)} CANDIDATES</span>
              </div>
              <div className="findings-list">
                {findings.map((a, i) => (
                  <section key={i} className="panel finding">
                    <div className="finding-top">
                      <span className="number mint">{count(i + 1)}</span>
                      <div>
                        <small className="eyebrow muted-text">{a.category}</small>
                        <h3>{a.title}</h3>
                      </div>
                      <div className="rank-score">
                        <strong>{a.score}</strong>
                        <span>/100</span>
                      </div>
                    </div>
                    <p>{a.why[0].text}</p>
                    <div className="factor-grid">
                      {[
                        ['Evidence', a.factors.evidence, '50%'],
                        ['Impact', a.factors.impact, '30%'],
                        ['History', a.factors.frequency, '20%'],
                      ].map(([t, v, w]) => (
                        <div key={t}>
                          <span>
                            {t}
                            <small>{Math.round(v * 100)}%</small>
                          </span>
                          <i>
                            <b style={{ width: `${Math.round(v * 100)}%` }} />
                          </i>
                          <em>{w} weight</em>
                        </div>
                      ))}
                    </div>
                    <div className="spread">
                      <Citation source={a.source} open={setSource} />
                      <button
                        className="text-link"
                        onClick={() => {
                          setSelected(i);
                          changeTab('whys');
                        }}
                      >
                        Inspect chain
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </section>
                ))}
              </div>
              <p className="page-note">
                Scores rank hypotheses; they are not probabilities. History uses related resolved
                cases, up to three matches.
              </p>
            </>
          ) : (
            <Empty
              Icon={ScanLine}
              title="Ready when you are"
              text="This draft has no analysis yet. Review the brief and evidence to generate causes, maps, and solutions."
              action={() => go('edit/' + id)}
              label="Review draft"
            />
          )}
        </>
      )}
      {tab === 'map' && R && (
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Waypoints size={17} />
              <h2>Ishikawa cause map</h2>
            </div>
            <span className="mini-tag">FIG. 01</span>
          </div>
          <div className="panel-body">
            <p className="section-intro">
              Select a numbered cause on the fishbone to inspect its mechanism and evidence.
            </p>
            <Fishbone
              causes={findings}
              title={c.title}
              selected={selected}
              onSelect={setSelected}
            />
            <div className="branch-detail">
              <span className="eyebrow">
                C{count(selected + 1)} / {f.category}
              </span>
              <h3>{f.title}</h3>
              <p>{f.why[0].text}</p>
              <div className="spread">
                <Citation source={f.source} open={setSource} />
                <button className="text-link" onClick={() => changeTab('whys')}>
                  Follow 5-Why chain
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
      {tab === 'whys' && R && (
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <GitBranch size={17} />
              <h2>5-Why causal chain</h2>
            </div>
            <span className="mini-tag">FIG. 02</span>
          </div>
          <div className="panel-body">
            {selectControl}
            <div className="why-chain">
              {f.why.map((w, i) => (
                <div className="why-node" key={i}>
                  <span className="why-dot">{count(i + 1)}</span>
                  <div>
                    <small className="eyebrow muted-text">WHY {i + 1}</small>
                    <p>{w.text}</p>
                    <Citation source={w.source} open={setSource} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {tab === 'actions' && R && (
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Lightbulb size={17} />
              <h2>Corrective action plan</h2>
            </div>
          </div>
          <div className="panel-body">
            {selectControl}
            <div className="action-list">
              {[
                ['contain', 'Immediate containment', Activity, 'amber'],
                ['prevent', 'Long-term prevention', ShieldCheck, 'mint'],
                ['verify', 'Verification test', FlaskConical, 'violet'],
              ].map(([k, t, I, color]) => (
                <div className="action-card" key={k}>
                  <span className={'pipe-icon ' + color}>
                    <I size={18} />
                  </span>
                  <div>
                    <h3>{t}</h3>
                    <p>{f[k]}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="info-box">
              <Info size={17} />
              <p>
                Review feasibility and safety before making changes. A successful verification test
                is stronger evidence than a high rank score.
              </p>
            </div>
          </div>
        </section>
      )}
      {tab === 'evidence' && (
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Paperclip size={17} />
              <h2>Evidence register</h2>
            </div>
            <button className="text-link" onClick={() => go('edit/' + id)}>
              Edit evidence
              <Pencil size={12} />
            </button>
          </div>
          <div className="panel-body">
            {!c.evidence.length ? (
              <Empty
                title="No evidence attached"
                text="Add a log, design note or measurement to support this investigation."
                action={() => go('edit/' + id)}
                label="Edit investigation"
              />
            ) : (
              c.evidence.map((d, i) => (
                <details
                  className="doc-detail"
                  key={i}
                  open={Number(docIndex ?? 0) === i || undefined}
                >
                  <summary>
                    <FileText size={16} />
                    <b>{d.name}</b>
                    <small>E{count(i + 1)}</small>
                    <ChevronDown size={14} />
                  </summary>
                  <pre>{d.text}</pre>
                </details>
              ))
            )}
          </div>
        </section>
      )}
      {source && (
        <Modal
          title="Matched evidence passage"
          kicker="SOURCE INSPECTOR"
          close={() => setSource(null)}
        >
          <div className="modal-body">
            <div className="spread">
              <b>{source.name}</b>
              <span className="mini-tag">PASSAGE {count(source.chunk)}</span>
            </div>
            <pre className="source-text">{source.excerpt}</pre>
            <p className="page-note">
              Cosine similarity: {source.similarity.toFixed(3)}. A text match identifies a related
              passage, not independent confirmation.
            </p>
            <button
              className="btn secondary"
              onClick={() => {
                setSource(null);
                go(`case/${id}/evidence/${source.doc}`);
              }}
            >
              Read full source
              <ArrowRight size={14} />
            </button>
          </div>
        </Modal>
      )}
      {modal && (
        <Modal
          title={
            modal === 'export'
              ? 'Export investigation report'
              : modal === 'cloud'
                ? 'Archive to Supabase'
                : c.status === 'Resolved'
                  ? 'Reopen this investigation?'
                  : 'Mark this case resolved?'
          }
          kicker={c.ref + ' / WORKSPACE ACTION'}
          close={() => !busy && setModal('')}
        >
          <div className="modal-body field-stack">
            <ErrorBox>{opError}</ErrorBox>
            {modal === 'export' ? (
              <>
                <p>
                  Download the current report, including ranked causes, evidence references, the
                  5-Why chain and corrective actions.
                </p>
                <a className="export-option" href={`/api/investigations/${id}/export/pdf`} download>
                  <FileDown size={21} />
                  <span>
                    <b>PDF report</b>
                    <small>Paginated engineering report with a vector cause map.</small>
                  </span>
                  <Download size={16} />
                </a>
                <a
                  className="export-option"
                  href={`/api/investigations/${id}/export/json`}
                  download
                >
                  <FileJson size={21} />
                  <span>
                    <b>Structured JSON</b>
                    <small>Portable incident, evidence and full inference output.</small>
                  </span>
                  <Download size={16} />
                </a>
              </>
            ) : modal === 'cloud' ? (
              <>
                <p>
                  This saves the incident, source text, passage vectors and report to your private
                  Supabase account. Archiving again updates the same case. Your SQLite copy stays on
                  this device’s server.
                </p>
                <div className="dialog-actions">
                  <button className="btn secondary" onClick={() => go('settings')}>
                    Cloud settings
                  </button>
                  <button className="btn primary" disabled={busy} onClick={archive}>
                    <CloudUpload size={15} />
                    {busy ? 'Archiving…' : 'Save to cloud'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  {c.status === 'Resolved'
                    ? 'Move this case back into review. Its report and evidence will be preserved.'
                    : 'Record the confirmed cause and observed result. Only verified causes can contribute to future history scores.'}
                </p>
                {c.status !== 'Resolved' && (
                  <>
                    <label className="field">
                      Confirmed cause
                      <select
                        value={causeIndex}
                        onChange={(e) => setCauseIndex(Number(e.target.value))}
                      >
                        {findings.map((a, i) => (
                          <option key={i} value={i}>
                            {a.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Verification result
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={verification}
                        onChange={(e) => setVerification(e.target.value)}
                        placeholder="What changed in the same operating conditions after the fix?"
                      />
                    </label>
                  </>
                )}
                <button
                  disabled={busy || (c.status !== 'Resolved' && verification.trim().length < 8)}
                  className="btn primary"
                  onClick={status}
                >
                  {busy
                    ? 'Saving…'
                    : c.status === 'Resolved'
                      ? 'Reopen for review'
                      : 'Confirm resolution'}
                  <Check size={15} />
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
