import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  FolderSearch,
  Files,
  FileBarChart2,
  Workflow,
  SlidersHorizontal,
  PanelLeft,
  ChevronRight,
  Search,
  X,
  Database,
  Terminal,
  ArrowUpRight,
  CheckCircle2,
  CornerDownLeft,
  Plus,
} from 'lucide-react';
import { api, go, count } from './api';
import { Logo, Loading, ErrorBox, Modal, PipelineModal, DomainIcon, Empty } from './components/Ui';
import Overview from './components/Overview';
import Library from './components/Library';
import Editor from './components/Editor';
import Case from './components/Case';
import Settings from './components/Settings';
import Atlas from './components/Atlas';
const nav = [
  ['overview', 'Overview', LayoutDashboard],
  ['investigations', 'Investigations', FolderSearch],
  ['evidence', 'Evidence vault', Files],
  ['reports', 'Reports', FileBarChart2],
  ['diagrams', 'Diagram library', Workflow],
  ['settings', 'System settings', SlidersHorizontal],
];
const getRoute = () => location.hash.replace(/^#\/?/, '') || 'overview';
function SearchBox({ cases, close }) {
  const [q, setQ] = useState(''),
    [idx, select] = useState(0);
  const ref = useRef();
  const all = [
    ...nav.map(([route, label, I]) => ({ route, label, meta: 'Workspace page', Icon: I })),
    { route: 'new', label: 'New investigation', meta: 'Workspace action', Icon: Plus },
    ...cases.map((c) => ({
      route: 'case/' + c.id,
      label: c.title,
      meta: c.ref + ' · ' + c.domain,
      domain: c.domain,
    })),
  ];
  const hits = q.trim()
    ? all
        .filter((h) => (h.label + ' ' + h.meta).toLowerCase().includes(q.trim().toLowerCase()))
        .slice(0, 18)
    : all.slice(7, 12);
  function open(i) {
    if (hits[i]) {
      close();
      go(hits[i].route);
    }
  }
  useEffect(() => {
    ref.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);
  return (
    <Modal title="Search workspace" kicker="COMMAND PALETTE" close={close}>
      <div className="palette-search">
        <Search size={17} />
        <input
          data-autofocus
          aria-label="Search workspace"
          placeholder="Find a case, page, or action…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            select(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              select((n) =>
                Math.max(0, Math.min(hits.length - 1, n + (e.key === 'ArrowDown' ? 1 : -1))),
              );
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              open(idx);
            }
          }}
        />
        <kbd>ESC</kbd>
      </div>
      <div className="palette-label">{q ? 'MATCHING RESULTS' : 'RECENT INVESTIGATIONS'}</div>
      <div className="palette-list" role="listbox" aria-label="Search results" ref={ref}>
        {hits.map((h, i) => (
          <button
            role="option"
            aria-selected={idx === i}
            key={h.route}
            className={idx === i ? 'selected' : ''}
            onMouseEnter={() => select(i)}
            onClick={() => open(i)}
          >
            {h.Icon ? (
              <span className="domain-icon blue">
                <h.Icon size={16} />
              </span>
            ) : (
              <DomainIcon domain={h.domain} />
            )}
            <span>
              <b>{h.label}</b>
              <small>{h.meta}</small>
            </span>
            <CornerDownLeft size={13} />
          </button>
        ))}
        {!hits.length && (
          <p className="page-note">No results for “{q}”. Try a title, case ID or page name.</p>
        )}
      </div>
      <div className="palette-help">
        <span>↑ ↓ &nbsp; Navigate</span>
        <span>↵ &nbsp; Open</span>
        <span>Esc &nbsp; Close</span>
      </div>
    </Modal>
  );
}
export default function App() {
  const [route, setRoute] = useState(getRoute),
    [ws, setWs] = useState(null),
    [error, setError] = useState(''),
    [mobile, setMobile] = useState(false),
    [narrow, setNarrow] = useState(false),
    [search, setSearch] = useState(false),
    [pipeline, setPipeline] = useState(false),
    [toast, setToast] = useState('');
  const timer = useRef(),
    initial = useRef(false);
  const refresh = useCallback(async () => {
    const data = await api('workspace');
    setWs(data);
    setError('');
    return data;
  }, []);
  useEffect(() => {
    if (!initial.current) {
      initial.current = true;
      refresh().catch((e) => setError(e.message));
    }
    const fn = () => {
      setRoute(getRoute());
      setMobile(false);
      setSearch(false);
      setPipeline(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, [refresh]);
  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPipeline(false);
        setSearch((s) => !s);
      }
      if (e.key === 'Escape') setMobile(false);
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);
  const notify = (msg) => {
    setToast(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 4000);
  };
  const [path, query] = route.split('?'),
    [page, id, tab, docIndex] = path.split('/'),
    base = ['new', 'edit', 'case'].includes(page) ? 'investigations' : page,
    title = nav.find((n) => n[0] === base)?.[1] || 'Workspace',
    params = new URLSearchParams(query);
  useEffect(() => {
    document.title = (page === 'new' ? 'New investigation' : title) + ' · Causalytix';
  }, [page, title]);
  const link = ([key, label, I]) => (
    <a
      key={key}
      href={'#/' + key}
      aria-current={base === key ? 'page' : undefined}
      title={label}
      className={'nav-item ' + (base === key ? 'active' : '')}
      onClick={() => setMobile(false)}
    >
      <I size={17} strokeWidth={1.7} />
      <span>{label}</span>
      {key === 'investigations' && ws && <small>{count(ws.cases.length)}</small>}
    </a>
  );
  return (
    <div className={'app-shell ' + (narrow ? 'slim ' : '') + (mobile ? 'menu-open' : '')}>
      <a
        className="skip"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="mobile-shade"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar">
        <a className="brand" href="#/overview" aria-label="Causalytix overview">
          <Logo />
          <span>
            <strong>Causalytix</strong>
            <small>RCA PLATFORM</small>
          </span>
        </a>
        <button
          className="mobile-close icon-btn"
          aria-label="Close menu"
          onClick={() => setMobile(false)}
        >
          <X size={18} />
        </button>
        <div className="side-nav">
          <div className="nav-label">WORKSPACE</div>
          <nav aria-label="Workspace navigation">{nav.slice(0, 4).map(link)}</nav>
          <div className="nav-label second">SYSTEM</div>
          <nav aria-label="System navigation">{nav.slice(4).map(link)}</nav>
        </div>
        <div className="side-bottom">
          <button className="storage-card" onClick={() => go('settings')} title="Storage settings">
            <span className="storage-heading">
              <Database size={13} />
              STORAGE NODES
              <ArrowUpRight size={11} />
            </span>
            <span className="storage-line">
              <i className={'live-dot ' + (!ws ? 'muted' : '')} />
              Local SQLite<small>{ws ? 'Online' : '—'}</small>
            </span>
            <span className="storage-line">
              <i className="cloud-dot" />
              Supabase<small>On demand</small>
            </span>
          </button>
          <div className="build-line">
            <Terminal size={13} />
            <span>Console build</span>
            <b>v1.0.0</b>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn side-toggle"
              aria-label="Toggle navigation"
              onClick={() =>
                window.innerWidth <= 800 ? setMobile((x) => !x) : setNarrow((x) => !x)
              }
            >
              <PanelLeft size={17} />
            </button>
            <i />
            <button onClick={() => go('overview')}>Workspace</button>
            <ChevronRight size={12} />
            <span>
              {page === 'new'
                ? 'New investigation'
                : page === 'edit'
                  ? 'Edit investigation'
                  : title}
            </span>
          </div>
          <div className="topbar-right">
            <button
              className="quick-search"
              aria-label="Open quick search"
              onClick={() => setSearch(true)}
            >
              <Search size={15} />
              <span>Quick search</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="system-health">
              <span className={'live-dot ' + (!ws ? 'muted' : '')} />
              {ws ? 'System online' : 'Connecting'}
            </div>
            <button
              className="profile"
              title="Workspace settings"
              aria-label="Workspace settings"
              onClick={() => go('settings')}
            >
              EN
            </button>
          </div>
        </header>
        <main className={'content view-' + page} id="main-content" tabIndex="-1">
          {error ? (
            <div>
              <ErrorBox>{error}</ErrorBox>
              <button
                className="btn secondary"
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                Reconnect
              </button>
            </div>
          ) : !ws ? (
            <Loading />
          ) : page === 'overview' ? (
            <Overview cases={ws.cases} onPipeline={() => setPipeline(true)} />
          ) : ['investigations', 'reports', 'evidence'].includes(page) ? (
            <Library key={route} type={page} cases={ws.cases} params={params} />
          ) : ['new', 'edit'].includes(page) ? (
            <Editor
              key={page + id}
              id={page === 'edit' ? id : null}
              workspace={ws}
              refresh={refresh}
              notify={notify}
            />
          ) : page === 'case' ? (
            <Case
              key={id}
              id={id}
              tab={tab || 'summary'}
              docIndex={docIndex}
              refresh={refresh}
              notify={notify}
            />
          ) : page === 'diagrams' ? (
            <Atlas />
          ) : page === 'settings' ? (
            <Settings workspace={ws} notify={notify} refresh={refresh} />
          ) : (
            <Empty
              title="Page not found"
              text="This route isn’t part of the workspace."
              label="Return to overview"
              action={() => go('overview')}
            />
          )}
        </main>
      </div>
      {search && <SearchBox cases={ws?.cases || []} close={() => setSearch(false)} />}
      {pipeline && <PipelineModal close={() => setPipeline(false)} />}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          {toast}
          <button
            aria-label="Dismiss notification"
            className="icon-btn"
            onClick={() => setToast('')}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
