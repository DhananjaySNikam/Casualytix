import React, { useEffect, useRef } from 'react';
import {
  Terminal,
  Cpu,
  X,
  AlertCircle,
  ScanLine,
  LoaderCircle,
  ChevronRight,
  Layers3,
  Files,
  Waypoints,
  FileCheck2,
  ArrowUpRight,
} from 'lucide-react';
import { go } from '../api';
export const pipeline = [
  {
    label: 'Incident intake',
    text: 'Define the problem and ingest evidence.',
    range: '01–02',
    Icon: Files,
    color: 'mint',
    stages: [
      ['Problem statement', 'Capture the failure, timeline, affected system and impact.'],
      ['Evidence ingestion', 'Extract readable text and index overlapping evidence passages.'],
    ],
  },
  {
    label: 'Causal reasoning',
    text: 'Map hypotheses and build 5-Why chains.',
    range: '03–05',
    Icon: Waypoints,
    color: 'violet',
    stages: [
      [
        'Cause generation',
        'Infer candidate failure modes with the local classifier or a configured language model.',
      ],
      [
        'Ishikawa mapping',
        'Organize candidate mechanisms into software or hardware cause branches.',
      ],
      [
        '5-Why expansion',
        'Trace five testable links from a symptom to a potential underlying cause.',
      ],
    ],
  },
  {
    label: 'Evidence validation',
    text: 'Match sources and rank likely causes.',
    range: '06–07',
    Icon: ScanLine,
    color: 'blue',
    stages: [
      [
        'Evidence matching',
        'Compute passage similarity per hypothesis and per Why. Mark unsupported links.',
      ],
      [
        'Root cause ranking',
        'Weight evidence match at 50%, impact at 30%, and historical frequency at 20%.',
      ],
    ],
  },
  {
    label: 'Resolution synthesis',
    text: 'Plan corrective actions and export.',
    range: '08–09',
    Icon: FileCheck2,
    color: 'amber',
    stages: [
      [
        'Corrective actions',
        'Pair immediate containment with prevention and a falsifiable verification test.',
      ],
      [
        'Report export',
        'Export a paginated PDF or structured JSON and optionally archive to Supabase.',
      ],
    ],
  },
];
export function Logo() {
  return (
    <svg viewBox="0 0 36 40" fill="none" className="brand-mark" aria-hidden="true">
      <path
        d="M18 1 34 10.2 27.8 13.8 18 8.2 8.3 13.8v11.1l9.7 5.6 9.7-5.6v-5.6l6.3-3.6v12.9l-16 9.2-16-9.2V10.2Z"
        fill="currentColor"
      />
      <path d="m12.8 16.4 5.2-3 5.2 3-5.2 3zM12.8 18.7l4.2 2.5v5.9l-4.2-2.5z" fill="currentColor" />
    </svg>
  );
}
export function DomainIcon({ domain, big = false }) {
  const Icon = domain === 'Hardware' ? Cpu : Terminal;
  return (
    <span className={`domain-icon ${domain === 'Hardware' ? 'violet' : 'mint'} ${big ? 'lg' : ''}`}>
      <Icon size={big ? 22 : 18} strokeWidth={1.7} />
    </span>
  );
}
export function Badge({ status }) {
  return (
    <span
      className={`badge ${status === 'Resolved' ? 'green' : status === 'In review' ? 'amber' : 'slate'}`}
    >
      <i />
      {status}
    </span>
  );
}
export function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <header className="page-head">
      <div>
        <div className="eyebrow">
          <span className="eyeline" />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </header>
  );
}
export function Empty({ title, text, action, label, Icon = Layers3 }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="btn secondary" onClick={action}>
          {label}
          <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
export function ErrorBox({ children }) {
  return children ? (
    <div className="error-box" role="alert">
      <AlertCircle size={17} />
      <span>{children}</span>
    </div>
  ) : null;
}
export function Loading({ text = 'Loading workspace…' }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={20} />
      {text}
    </div>
  );
}
export function Modal({ title, kicker, close, children, wide = false }) {
  const ref = useRef(null),
    closer = useRef(close);
  closer.current = close;
  useEffect(() => {
    const previous = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll(
          'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
        ) || [],
      );
    (ref.current?.querySelector('[data-autofocus]') || focusable()[0])?.focus();
    function key(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closer.current();
      }
      if (e.key === 'Tab') {
        const l = focusable();
        if (!l.length) return;
        if (e.shiftKey && document.activeElement === l[0]) {
          e.preventDefault();
          l.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === l.at(-1)) {
          e.preventDefault();
          l[0].focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', key);
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={ref}
        className={'modal ' + (wide ? 'wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="modal-head">
          <div>
            {kicker && <div className="eyebrow">{kicker}</div>}
            <h2>{title}</h2>
          </div>
          <button aria-label="Close dialog" className="icon-btn" onClick={close}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function PipelineModal({ close }) {
  let n = 0;
  return (
    <Modal title="The diagnostic pipeline" kicker="SYSTEM DESIGN / 09 STAGES" close={close}>
      <p className="modal-intro">
        From the first incident signal to a reviewable engineering report.
      </p>
      <div className="stage-list">
        {pipeline.flatMap((g) =>
          g.stages.map(([t, d]) => (
            <div className="stage-row" key={t}>
              <span className={'number ' + g.color}>{String(++n).padStart(2, '0')}</span>
              <div>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            </div>
          )),
        )}
      </div>
      <div className="modal-foot">
        <button
          className="btn primary"
          onClick={() => {
            close();
            go('new');
          }}
        >
          Start an investigation
          <ArrowUpRight size={16} />
        </button>
      </div>
    </Modal>
  );
}
