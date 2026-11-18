import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Save,
  Plus,
  Check,
  FileText,
  UploadCloud,
  Trash2,
  Cpu,
  Terminal,
  ScanLine,
  ShieldCheck,
  Layers3,
  LoaderCircle,
  Info,
  Paperclip,
  ChevronRight,
} from 'lucide-react';
import { api, go, count } from '../api';
import { PageHead, ErrorBox, Loading, Modal } from './Ui';
const empty = {
  title: '',
  description: '',
  domain: 'Software',
  system: '',
  timeline: '',
  severity: 'Medium',
  evidence: [],
  engine: 'local',
};
const stages = [
  ['Incident brief', 'Scope the failure'],
  ['Evidence intake', 'Add supporting material'],
  ['Review & analyze', 'Choose an inference engine'],
];
export default function Editor({ id, workspace, refresh, notify }) {
  const [form, setForm] = useState({ ...empty, engine: workspace.llm ? 'llm' : 'local' }),
    [step, setStep] = useState(0),
    [loading, setLoading] = useState(!!id),
    [loadError, setLoadError] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [note, setNote] = useState(null),
    [drag, setDrag] = useState(false);
  const picker = useRef(),
    formRef = useRef();
  useEffect(() => {
    if (!id) return;
    let active = true;
    api(`investigations/${id}`)
      .then((d) => {
        if (active) setForm({ ...empty, ...d, engine: workspace.llm ? 'llm' : 'local' });
      })
      .catch((e) => active && setLoadError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);
  const put = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));
  function valid() {
    if (form.title.trim().length < 3 || form.description.trim().length < 10) {
      setStep(0);
      setError(
        'Enter a title of at least 3 characters and describe the failure in at least 10 characters.',
      );
      return false;
    }
    return true;
  }
  async function save(run) {
    if (!valid() || busy) return;
    setBusy(run ? 'Analyzing evidence…' : 'Saving draft…');
    setError('');
    try {
      const data = await api('investigations' + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        body: { ...Object.fromEntries(Object.keys(empty).map((k) => [k, form[k]])), run },
      });
      await refresh();
      notify(
        run
          ? 'Analysis complete. Review the hypotheses and their evidence.'
          : 'Draft saved to your local workspace.',
      );
      go('case/' + data.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  async function upload(files) {
    const list = Array.from(files || []);
    if (!list.length || busy) return;
    setError('');
    if (list.length + form.evidence.length > 6) {
      setError('Attach at most six evidence items.');
      return;
    }
    setBusy('Reading evidence…');
    let good = [];
    let errors = [];
    for (const file of list) {
      try {
        if (file.size > 2000000) throw Error('File exceeds 2 MB.');
        const fd = new FormData();
        fd.append('file', file);
        good.push(await api('evidence/parse', { method: 'POST', body: fd }));
      } catch (e) {
        errors.push(file.name + ': ' + e.message);
      }
    }
    setForm((f) => ({ ...f, evidence: [...f.evidence, ...good].slice(0, 6) }));
    setError(errors.join(' '));
    setBusy('');
    if (picker.current) picker.current.value = '';
  }
  if (loading) return <Loading />;
  if (loadError) return <ErrorBox>{loadError}</ErrorBox>;
  return (
    <>
      <PageHead
        eyebrow="INVESTIGATION BUILDER"
        title={id ? 'Edit investigation' : 'New investigation'}
        subtitle="Define the failure, attach evidence, and trace a reviewable cause."
      />
      <div className="wizard-steps">
        {stages.map(([t, s], i) => (
          <button
            disabled={!!busy || i > step}
            key={t}
            className={'wizard-step ' + (i === step ? 'current' : i < step ? 'done' : '')}
            onClick={() => {
              setStep(i);
              setError('');
            }}
          >
            <span>{i < step ? <Check size={16} /> : count(i + 1)}</span>
            <b>{t}</b>
            {i < 2 && <ChevronRight className="step-arrow" size={14} />}
          </button>
        ))}
      </div>
      <div className="builder-grid">
        <section className="panel builder-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Layers3 size={17} />
              <h2>{stages[step][0]}</h2>
            </div>
            <span className="mini-tag">STEP {count(step + 1)} / 03</span>
          </div>
          <div className="panel-body">
            <ErrorBox>{error}</ErrorBox>
            {step === 0 && (
              <form
                ref={formRef}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (valid()) {
                    setError('');
                    setStep(1);
                  }
                }}
                className="field-stack"
              >
                <fieldset className="field">
                  <legend>Incident domain</legend>
                  <div className="domain-picker">
                    {[
                      ['Software', Terminal, 'Applications & infrastructure'],
                      ['Hardware', Cpu, 'Devices & physical systems'],
                    ].map(([d, I, s]) => (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={form.domain === d}
                        className={form.domain === d ? 'chosen' : ''}
                        onClick={() => put('domain', d)}
                      >
                        <I size={20} />
                        <span>
                          <b>{d}</b>
                          <small>{s}</small>
                        </span>
                        <i>{form.domain === d && <Check size={11} />}</i>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className="field">
                  Incident title{' '}
                  <input
                    autoFocus
                    required
                    minLength="3"
                    maxLength="120"
                    placeholder={
                      form.domain === 'Software'
                        ? 'e.g. API requests time out during peak traffic'
                        : 'e.g. Edge controller resets under load'
                    }
                    value={form.title}
                    onChange={(e) => put('title', e.target.value)}
                  />
                </label>
                <label className="field">
                  Problem description
                  <textarea
                    rows="4"
                    required
                    minLength="10"
                    maxLength="12000"
                    placeholder="What did you expect, what happened instead, and how can the difference be observed?"
                    value={form.description}
                    onChange={(e) => put('description', e.target.value)}
                  />
                </label>
                <div className="field-pair">
                  <label className="field">
                    Affected system{' '}
                    <input
                      maxLength="180"
                      placeholder="Component, device, or service"
                      value={form.system}
                      onChange={(e) => put('system', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Severity impact
                    <select value={form.severity} onChange={(e) => put('severity', e.target.value)}>
                      {['Low', 'Medium', 'High', 'Critical'].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>
                    Baseline & timeline <em>Optional</em>
                  </span>
                  <textarea
                    rows="2"
                    maxLength="2000"
                    placeholder="When did it start? What changed since the last healthy run?"
                    value={form.timeline}
                    onChange={(e) => put('timeline', e.target.value)}
                  />
                </label>
                <button hidden type="submit">
                  Continue
                </button>
              </form>
            )}
            {step === 1 && (
              <div className="field-stack">
                <p className="section-intro">
                  Add logs, design notes, measurements or a text-based PDF. Each related passage can
                  be traced back to its source.
                </p>
                <input
                  ref={picker}
                  type="file"
                  multiple
                  accept=".txt,.log,.csv,.json,.md,.pdf"
                  hidden
                  onChange={(e) => upload(e.target.files)}
                />
                <button
                  className={'dropzone ' + (drag ? 'drag' : '')}
                  disabled={!!busy || form.evidence.length >= 6}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    upload(e.dataTransfer.files);
                  }}
                  onClick={() => picker.current.click()}
                >
                  <UploadCloud size={30} />
                  <b>
                    Drop evidence here or <span>browse files</span>
                  </b>
                  <small>TXT, LOG, CSV, JSON, MD, PDF · 2 MB each</small>
                </button>
                <div className="spread">
                  <span className="eyebrow muted-text">
                    ATTACHED / {count(form.evidence.length)} OF 06
                  </span>
                  <button
                    className="text-link"
                    disabled={!!busy || form.evidence.length >= 6}
                    onClick={() => setNote({ name: '', text: '' })}
                  >
                    <Plus size={14} />
                    Paste a note
                  </button>
                </div>
                {form.evidence.map((d, i) => (
                  <div className="attach-row" key={i}>
                    <FileText size={17} className="mint-text" />
                    <div>
                      <b>{d.name}</b>
                      <small>{d.text.length.toLocaleString()} characters</small>
                    </div>
                    <button
                      aria-label={'Remove ' + d.name}
                      className="icon-btn"
                      disabled={!!busy}
                      onClick={() =>
                        put(
                          'evidence',
                          form.evidence.filter((_, j) => i !== j),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {!form.evidence.length && (
                  <p className="info-line">
                    <Info size={15} />
                    You can continue without files. Unsupported hypotheses will be flagged.
                  </p>
                )}
              </div>
            )}
            {step === 2 && (
              <div className="field-stack">
                <div className="review-brief">
                  <span className="eyebrow">INCIDENT SUMMARY</span>
                  <h3>{form.title}</h3>
                  <p>{form.description}</p>
                  <div className="chips">
                    <span>{form.domain}</span>
                    <span>{form.severity} impact</span>
                    <span>{form.evidence.length} evidence items</span>
                  </div>
                </div>
                <label className="field">
                  Inference engine
                  <select value={form.engine} onChange={(e) => put('engine', e.target.value)}>
                    <option value="local">Local classifier · private, offline</option>
                    <option disabled={!workspace.llm} value="llm">
                      {workspace.llm
                        ? workspace.model + ' · language model'
                        : 'Language model · not configured'}
                    </option>
                  </select>
                </label>
                <div className="info-box">
                  <ShieldCheck size={20} />
                  <p>
                    {form.engine === 'llm'
                      ? 'The incident brief, selected evidence passages, and similar case titles will be sent to the configured model endpoint.'
                      : 'The local model classifies failure patterns on this server. No incident data is sent to a model provider.'}{' '}
                    Your case is saved to SQLite; cloud archival is optional.
                  </p>
                </div>
                {id && (
                  <p className="info-line">
                    <Info size={15} />
                    Saving replaces the previous analysis. Export the old report first if needed.
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="builder-foot">
            <button
              className="btn subtle"
              disabled={!!busy}
              onClick={() => {
                if (step) {
                  setError('');
                  setStep(step - 1);
                } else go(id ? 'case/' + id : 'overview');
              }}
            >
              <ArrowLeft size={15} />
              {step ? 'Back' : 'Cancel'}
            </button>
            <div>
              <button className="btn secondary" disabled={!!busy} onClick={() => save(false)}>
                <Save size={14} />
                Save draft
              </button>
              {step < 2 ? (
                <button
                  className="btn primary"
                  disabled={!!busy}
                  onClick={() => {
                    if (step === 0) {
                      formRef.current?.requestSubmit();
                    } else {
                      setError('');
                      setStep(2);
                    }
                  }}
                >
                  Continue
                  <ArrowRight size={15} />
                </button>
              ) : (
                <button className="btn primary" disabled={!!busy} onClick={() => save(true)}>
                  {busy ? <LoaderCircle size={15} className="spin" /> : <ScanLine size={15} />}Run
                  analysis
                </button>
              )}
            </div>
          </div>
          {busy && (
            <div role="status" className="busy-line">
              <LoaderCircle className="spin" size={14} />
              {busy}
            </div>
          )}
        </section>
        <aside className="panel guide">
          <div className="guide-head">
            <ScanLine size={22} />
            <span className="eyebrow">FIELD GUIDE</span>
          </div>
          <h3>
            {
              [
                'Start with the symptom.',
                'Keep the signal in context.',
                'Review before you resolve.',
              ][step]
            }
          </h3>
          <p>
            {
              [
                'Describe observations, not just suspected causes. A useful brief gives the engine a baseline to compare against.',
                'Attach evidence from the same failure window. Redact passwords, personal information, and unrelated customer data.',
                'The engine proposes testable mechanisms. A related log line improves ranking, but cannot prove causality by itself.',
              ][step]
            }
          </p>
          <div className="guide-note">
            <b>What you’ll get</b>
            {[
              'Ranked cause hypotheses',
              'Ishikawa and 5-Why diagrams',
              'Source-linked verification tests',
              'Corrective and preventive actions',
            ].map((t) => (
              <span key={t}>
                <Check size={14} />
                {t}
              </span>
            ))}
          </div>
        </aside>
      </div>
      {note && (
        <Modal title="Add an evidence note" kicker="EVIDENCE INTAKE" close={() => setNote(null)}>
          <form
            className="modal-body field-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.name.trim() || !note.text.trim()) return;
              put('evidence', [
                ...form.evidence,
                { name: note.name.trim(), text: note.text.trim() },
              ]);
              setNote(null);
            }}
          >
            <label className="field">
              Source name
              <input
                data-autofocus
                required
                maxLength="160"
                placeholder="e.g. Design review notes"
                value={note.name}
                onChange={(e) => setNote({ ...note, name: e.target.value })}
              />
            </label>
            <label className="field">
              Observation or design excerpt
              <textarea
                required
                rows="7"
                maxLength="80000"
                value={note.text}
                onChange={(e) => setNote({ ...note, text: e.target.value })}
              />
            </label>
            <button className="btn primary" type="submit">
              <Paperclip size={15} />
              Attach note
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
