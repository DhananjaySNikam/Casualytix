import React, { useEffect, useState } from 'react';
import {
  Cloud,
  LogOut,
  ShieldCheck,
  Cpu,
  Download,
  CopyPlus,
  RefreshCw,
  KeyRound,
  HardDrive,
  Info,
  Check,
} from 'lucide-react';
import { api, go, dt, downloadJSON } from '../api';
import { cloud, cloudSession, cloudHost, listArchives, readArchive } from '../cloud';
import { PageHead, ErrorBox, Empty } from './Ui';
export default function Settings({ workspace, notify, refresh }) {
  const [session, setSession] = useState(null),
    [archives, setArchives] = useState([]),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(''),
    [mode, setMode] = useState('signin'),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  useEffect(() => {
    let active = true;
    cloudSession()
      .then(async (s) => {
        if (!active) return;
        setSession(s);
        if (s) {
          const rows = await listArchives();
          if (active) setArchives(rows);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  async function work(label, fn) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(`${e.message || 'Cloud request failed.'} Your local data is unchanged.`);
    } finally {
      setBusy('');
    }
  }
  const auth = (e) => {
    e.preventDefault();
    work('Connecting…', async () => {
      const client = await cloud();
      const res =
        mode === 'signin'
          ? await client.auth.signInWithPassword({ email, password })
          : await client.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: location.origin },
            });
      if (res.error) throw res.error;
      setPassword('');
      if (res.data.session) {
        setSession(res.data.session);
        setArchives(await listArchives());
        setMessage('Connected to your private archive.');
      } else setMessage('Check your email to confirm the account, then sign in here.');
    });
  };
  return (
    <>
      <PageHead
        eyebrow="SYSTEM CONFIGURATION"
        title="System settings"
        subtitle="Inspect your inference engine and manage local and cloud storage."
      />
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <HardDrive size={17} />
              <h2>Local workspace</h2>
            </div>
            <span className="badge green">
              <i />
              Online
            </span>
          </div>
          <div className="panel-body">
            <p className="section-intro">
              Incidents and evidence are saved on this application host. This browser’s signed
              session opens your workspace.
            </p>
            <dl className="kv">
              <div>
                <dt>Storage engine</dt>
                <dd>SQLite · WAL</dd>
              </div>
              <div>
                <dt>Workspace cases</dt>
                <dd>{workspace.cases.length}</dd>
              </div>
              <div>
                <dt>Cloud transfer</dt>
                <dd>Manual, opt-in</dd>
              </div>
            </dl>
            <p className="info-line">
              <Info size={15} />
              Export or archive important cases before clearing browser cookies.
            </p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Cpu size={17} />
              <h2>Analysis engines</h2>
            </div>
          </div>
          <div className="panel-body">
            <dl className="kv">
              <div>
                <dt>Local classifier</dt>
                <dd className="mint-text">Ready</dd>
              </div>
              <div>
                <dt>Language model</dt>
                <dd>{workspace.llm ? workspace.model : 'Not configured'}</dd>
              </div>
              <div>
                <dt>Passage vectors</dt>
                <dd>256 dimensions</dd>
              </div>
            </dl>
            <p className="page-note">
              For generative analysis, configure <code>OPENAI_API_KEY</code> or a local{' '}
              <code>LLM_BASE_URL</code> on the server, then restart. Select the engine before
              running an investigation.
            </p>
          </div>
        </section>
      </div>
      <section className="panel cloud-panel">
        <div className="panel-heading">
          <div className="panel-title">
            <Cloud size={18} />
            <h2>Supabase archive</h2>
          </div>
          <span className={'badge ' + (session ? 'green' : 'slate')}>
            <i />
            {session ? 'Signed in' : 'Not signed in'}
          </span>
        </div>
        <div className="panel-body">
          <ErrorBox>{error}</ErrorBox>
          {message && (
            <div role="status" className="success-box">
              <Check size={16} />
              {message}
            </div>
          )}
          {!session ? (
            <div className="cloud-layout">
              <div>
                <span className="eyebrow">CLOUD STORAGE / OPTIONAL</span>
                <h3>A private copy beyond this device.</h3>
                <p>
                  Sign in to store selected investigations, source passages and reports in
                  PostgreSQL with pgvector. Row-level security restricts each archive to its owner.
                </p>
                <p className="info-line">
                  <ShieldCheck size={16} />
                  Nothing is uploaded just by signing in.
                </p>
                <code className="project-host">{cloudHost() || 'Invalid cloud project URL'}</code>
              </div>
              <form className="auth-form field-stack" onSubmit={auth}>
                <div className="segmented">
                  {[
                    ['signin', 'Sign in'],
                    ['signup', 'Create account'],
                  ].map(([k, t]) => (
                    <button
                      type="button"
                      key={k}
                      className={mode === k ? 'active' : ''}
                      onClick={() => {
                        setMode(k);
                        setError('');
                        setMessage('');
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <label className="field">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="engineer@example.com"
                  />
                </label>
                <label className="field">
                  Password
                  <input
                    type="password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={mode === 'signup' ? 8 : 1}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="btn primary" disabled={!!busy}>
                  <KeyRound size={15} />
                  {busy || (mode === 'signin' ? 'Connect to Supabase' : 'Create cloud account')}
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="spread">
                <div>
                  <span className="eyebrow">AUTHENTICATED ARCHIVE</span>
                  <h3>{session.user.email}</h3>
                </div>
                <button
                  className="btn secondary small"
                  disabled={!!busy}
                  onClick={() =>
                    work('Signing out…', async () => {
                      const cl = await cloud();
                      const { error } = await cl.auth.signOut({ scope: 'local' });
                      if (error) throw error;
                      setSession(null);
                      setArchives([]);
                    })
                  }
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
              <div className="subhead">
                <h3>Archived investigations</h3>
                <button
                  className="text-link"
                  disabled={!!busy}
                  onClick={() => work('Refreshing…', async () => setArchives(await listArchives()))}
                >
                  <RefreshCw size={13} />
                  Refresh
                </button>
              </div>
              {archives.length === 0 ? (
                <Empty
                  Icon={Cloud}
                  title="No archived cases yet"
                  text="Open an investigation and choose Archive to cloud to save its first snapshot."
                  action={() => go('investigations')}
                  label="Open investigations"
                />
              ) : (
                archives.map((row) => (
                  <div className="archive-row" key={row.id}>
                    <span>
                      <b>{row.details.title}</b>
                      <small>
                        {row.details.ref} · {dt(row.updated_at)}
                      </small>
                    </span>
                    <button
                      className="btn secondary small"
                      disabled={!!busy}
                      onClick={() =>
                        work('Reading archive…', async () =>
                          downloadJSON(row.details.ref + '-archive.json', await readArchive(row)),
                        )
                      }
                    >
                      <Download size={13} />
                      JSON
                    </button>
                    <button
                      className="btn secondary small"
                      disabled={!!busy}
                      onClick={() =>
                        work('Restoring…', async () => {
                          const a = await readArchive(row);
                          const c = await api('investigations', {
                            method: 'POST',
                            body: { ...a, run: false },
                          });
                          await refresh();
                          notify('Restored as a new local draft. The cloud snapshot is unchanged.');
                          go('case/' + c.id);
                        })
                      }
                    >
                      <CopyPlus size={13} />
                      Restore as draft
                    </button>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
