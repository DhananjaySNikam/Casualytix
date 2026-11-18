import React, { useState } from 'react';
import {
  Plus,
  Search,
  FileBarChart2,
  ArrowUpRight,
  Download,
  FolderSearch,
  FileCode2,
  Files,
} from 'lucide-react';
import { go, dt, count } from '../api';
import { PageHead, Empty } from './Ui';
import { CaseRow } from './Overview';
export default function Library({ type, cases, params }) {
  const [query, setQuery] = useState(''),
    [domain, setDomain] = useState('All domains'),
    [status, setStatus] = useState(params.get('status') || 'All statuses');
  const isInv = type === 'investigations',
    isEv = type === 'evidence';
  let src = cases.filter(
    (c) =>
      (domain === 'All domains' || c.domain === domain) &&
      (status === 'All statuses' || c.status === status),
  );
  if (type === 'reports') src = src.filter((c) => c.status !== 'Draft');
  const rows = (
    isEv ? src.flatMap((c) => c.files.map((f) => ({ c, f }))) : src.map((c) => ({ c }))
  ).filter(({ c, f }) =>
    [c.title, c.ref, c.system, f?.name].join(' ').toLowerCase().includes(query.toLowerCase()),
  );
  const title = isInv ? 'Investigations' : isEv ? 'Evidence vault' : 'Reports';
  return (
    <>
      <PageHead
        eyebrow={isInv ? 'CASE REGISTRY' : isEv ? 'SOURCE REGISTRY' : 'ANALYSIS OUTPUT'}
        title={title}
        subtitle={
          isInv
            ? 'Track each incident from first observation to verified resolution.'
            : isEv
              ? 'Browse the source material behind your investigations.'
              : 'Review and export the latest analysis for each investigation.'
        }
      >
        <button className="btn primary" onClick={() => go('new')}>
          <Plus size={16} />
          New investigation
        </button>
      </PageHead>
      <div className="panel library-panel">
        <div className="filter-bar">
          <div className="input-icon">
            <Search size={16} />
            <input
              placeholder={isEv ? 'Search files or investigations…' : 'Search investigations…'}
              aria-label={'Search ' + title}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Filter by domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          >
            {['All domains', 'Software', 'Hardware'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          {!isEv && (
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {['All statuses', 'In review', 'Resolved', ...(isInv ? ['Draft'] : [])].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}
        </div>
        <div className="list-caption">
          <span>{isInv ? 'INVESTIGATION INDEX' : isEv ? 'EVIDENCE INDEX' : 'RCA DOCUMENTS'}</span>
          <span>
            {count(rows.length)} {rows.length === 1 ? 'RECORD' : 'RECORDS'}
          </span>
        </div>
        {rows.length === 0 ? (
          <Empty
            Icon={isEv ? Files : FolderSearch}
            title="No matching records"
            text="Try another search or clear your filters."
            action={() => {
              setQuery('');
              setStatus('All statuses');
              setDomain('All domains');
            }}
            label="Clear filters"
          />
        ) : (
          rows.map(({ c, f }) =>
            isInv ? (
              <CaseRow key={c.id} c={c} />
            ) : isEv ? (
              <button
                className="record-row"
                key={c.id + f.index}
                onClick={() => go(`case/${c.id}/evidence/${f.index}`)}
              >
                <span className="domain-icon blue">
                  <FileCode2 size={18} />
                </span>
                <span className="case-main">
                  <b>{f.name}</b>
                  <small>
                    {c.ref} · {c.title}
                  </small>
                </span>
                <span className="file-size mono">{(f.bytes / 1024).toFixed(1)} KB</span>
                <ArrowUpRight size={15} className="dim" />
              </button>
            ) : (
              <div className="record-row" key={c.id}>
                <span className="domain-icon violet">
                  <FileBarChart2 size={18} />
                </span>
                <button className="case-main inline-open" onClick={() => go('case/' + c.id)}>
                  <b>{c.title}</b>
                  <small>
                    {c.ref} · {dt(c.updated_at)}
                  </small>
                </button>
                <a
                  className="btn small secondary"
                  href={`/api/investigations/${c.id}/export/pdf`}
                  download
                >
                  <Download size={14} />
                  PDF
                </a>
                <a
                  className="btn small subtle"
                  href={`/api/investigations/${c.id}/export/json`}
                  download
                >
                  JSON
                </a>
              </div>
            ),
          )
        )}
      </div>
      <p className="page-note">
        Starter cases are marked in the investigation brief. They never contribute to the history
        score of a real case.
      </p>
    </>
  );
}
