import React, { useId } from 'react';
import {
  CalendarDays,
  Plus,
  ArrowRight,
  ArrowUpRight,
  FolderSearch,
  ScanLine,
  CircleCheck,
  Files,
  Workflow,
  Clock3,
  ChevronRight,
  Layers3,
} from 'lucide-react';
import { go, count, age } from '../api';
import { PageHead, DomainIcon, Badge, pipeline } from './Ui';
function Spark({ values }) {
  const id = useId().replace(/:/g, '');
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [2 + (i * 83) / (values.length - 1), 26 - (v / max) * 21]);
  let d = `M${pts[0].join(' ')}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i],
      prev = pts[i - 1],
      mid = (prev[0] + x) / 2;
    d += ` C${mid} ${prev[1]} ${mid} ${y} ${x} ${y}`;
  }
  return (
    <svg
      className="spark"
      viewBox="0 0 88 31"
      role="img"
      aria-label="Rolling 36-hour activity over the last 7 days"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M2 27H85"
        stroke="currentColor"
        strokeOpacity=".16"
        strokeWidth=".7"
        strokeDasharray="2 3"
      />
      <path d={d + ' L85 31 L2 31 Z'} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <circle cx="85" cy={pts.at(-1)[1]} r="1.6" fill="currentColor" />
    </svg>
  );
}
function Stats({ cases }) {
  const stats = [
    {
      name: 'Total investigations',
      Icon: FolderSearch,
      color: 'mint',
      items: cases,
      route: 'investigations',
    },
    {
      name: 'In review',
      Icon: ScanLine,
      color: 'amber',
      items: cases.filter((c) => c.status === 'In review'),
      route: 'investigations?status=In+review',
    },
    {
      name: 'Resolved',
      Icon: CircleCheck,
      color: 'blue',
      items: cases.filter((c) => c.status === 'Resolved'),
      route: 'investigations?status=Resolved',
    },
    {
      name: 'Evidence files',
      Icon: Files,
      color: 'violet',
      items: cases.flatMap((c) => c.files.map(() => c)),
      route: 'evidence',
    },
  ];
  return (
    <section className="stats-grid" aria-label="Workspace metrics">
      {stats.map(({ name, Icon, color, items, route }) => {
        const now = Date.now();
        const vals = Array.from({ length: 15 }, (_, i) => {
          const at = now - (14 - i) * 43200000;
          return items.filter(
            (c) => Date.parse(c.updated_at) <= at && Date.parse(c.updated_at) > at - 36 * 3600000,
          ).length;
        });
        return (
          <button className={'stat-card ' + color} key={name} onClick={() => go(route)}>
            <div className="stat-top">
              <span className="stat-icon">
                <Icon size={16} strokeWidth={1.7} />
              </span>
              <span>{name}</span>
            </div>
            <div className="stat-bottom">
              <strong>{count(items.length)}</strong>
              <Spark values={vals} />
            </div>
          </button>
        );
      })}
    </section>
  );
}
export function CaseRow({ c, compact = false }) {
  return (
    <button className={'case-row ' + (compact ? 'compact' : '')} onClick={() => go('case/' + c.id)}>
      <DomainIcon domain={c.domain} />
      <span className="case-main">
        <b>{c.title}</b>
        <small>
          <span className="mono">{c.ref}</span>
          <i />
          {c.domain}
          {!compact && (
            <>
              <i />
              {age(c.updated_at)}
            </>
          )}
        </small>
      </span>
      <Badge status={c.status} />
      <ChevronRight size={15} className="dim row-arrow" />
    </button>
  );
}
export default function Overview({ cases, onPipeline }) {
  return (
    <>
      <PageHead eyebrow="OPERATIONS CONSOLE" title="Workspace overview">
        <span className="date-tag">
          <CalendarDays size={14} />
          {new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }).format(new Date())}
        </span>
      </PageHead>
      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-art">
          <img
            src="/assets/inference-core.webp"
            alt="Exploded engineering view of the inference core"
          />
        </div>
        <span className="hero-corner tl" />
        <span className="hero-corner br" />
        <div className="hero-copy">
          <div className="hero-label">
            <span className="engine-dot" /> AI DIAGNOSTIC ENGINE{' '}
            <span className="label-slash">/</span> V1.0
          </div>
          <h2>
            Root cause intelligence<span>.</span>
          </h2>
          <p>
            Turn software and hardware failures into evidence-backed
            <br className="wide-break" /> root causes and actionable solutions.
          </p>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => go('new')}>
              <Plus size={17} />
              New investigation
            </button>
            <button className="hero-link" onClick={onPipeline}>
              View pipeline
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <div className="core-annotation top" aria-hidden="true">
          <i />
          <span>INFERENCE LAYER</span>
        </div>
        <div className="core-annotation lower" aria-hidden="true">
          <span>CONTEXT BUS</span>
          <i />
        </div>
        <span className="figure-label">
          <span />
          FIG. 01 <i>/</i> INFERENCE CORE
        </span>
      </section>
      <Stats cases={cases} />
      <div className="overview-grid">
        <section className="panel recents">
          <div className="panel-heading">
            <div className="panel-title">
              <Clock3 size={17} />
              <h2>Recent investigations</h2>
            </div>
            <button className="text-link" onClick={() => go('investigations')}>
              View all <ArrowRight size={13} />
            </button>
          </div>
          <div className="case-list">
            {cases.slice(0, 5).map((c) => (
              <CaseRow key={c.id} c={c} compact />
            ))}
          </div>
          <div className="panel-foot">
            <span className="live-dot muted" /> Last activity
            {cases.some((c) => c.sample) ? ' · Includes starter cases' : ''}
            <span className="foot-counter mono">
              {count(Math.min(5, cases.length))} / {count(cases.length)}
            </span>
          </div>
        </section>
        <section className="panel pipeline-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Workflow size={17} />
              <h2>Analysis pipeline</h2>
            </div>
            <span className="mini-tag">9 STAGES</span>
          </div>
          <div className="pipe-list">
            {pipeline.map(({ label, Icon, color, range, text }) => (
              <button key={label} className="pipe-row" onClick={onPipeline}>
                <span className={'pipe-icon ' + color}>
                  <Icon size={17} />
                </span>
                <span>
                  <small>STAGE {range}</small>
                  <b>{label}</b>
                  <em>{text}</em>
                </span>
                <ChevronRight size={14} className="pipe-arrow" />
              </button>
            ))}
          </div>
          <button className="pipe-footer" onClick={() => go('diagrams')}>
            <Layers3 size={13} />
            Diagram library
            <ArrowUpRight size={13} />
          </button>
        </section>
      </div>
      <div className="workspace-footer">
        <span>
          <span className="live-dot" />
          LOCAL WORKSPACE
        </span>
        <span>
          CAUSALYTIX <i>/</i> DIAGNOSTIC PLATFORM
        </span>
      </div>
    </>
  );
}
