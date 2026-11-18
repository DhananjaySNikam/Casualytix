import { api } from './api';
// Browser-safe deployment settings. This is a public client identifier, NOT a service key.
export const cloudUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://jmnlnhyfdswfyphfeqdp.supabase.co';
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_BSt23FbTIeshOd4Jd-tn9g_2hK7NwAy';
export function cloudHost() {
  try {
    return new URL(cloudUrl).hostname;
  } catch {
    return '';
  }
}
let promise;
export async function cloud() {
  if (!cloudHost() || !key)
    throw Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then rebuild.');
  if (!promise)
    promise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(cloudUrl, key, {
        auth: { persistSession: true, detectSessionInUrl: false },
        global: {
          fetch: (url, opts) =>
            fetch(url, {
              ...opts,
              signal: opts?.signal
                ? AbortSignal.any([opts.signal, AbortSignal.timeout(15000)])
                : AbortSignal.timeout(15000),
            }),
        },
      }),
    );
  return promise;
}
export async function cloudSession() {
  const client = await cloud();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}
export async function archiveCase(id) {
  const client = await cloud(),
    payload = await api(`investigations/${id}/snapshot`);
  const { error } = await client.rpc('cx_save_case', { payload });
  if (error) throw Error(error.message);
}
export async function listArchives() {
  const client = await cloud();
  const { data, error } = await client
    .from('cx_incidents')
    .select('id,details,updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) throw Error(error.message);
  return data;
}
export async function readArchive(row) {
  const client = await cloud();
  const [docs, reports] = await Promise.all([
    client
      .from('cx_evidence_docs')
      .select('name,content')
      .eq('incident_id', row.id)
      .order('doc_no'),
    client.from('cx_reports').select('report').eq('incident_id', row.id).maybeSingle(),
  ]);
  if (docs.error || reports.error) throw Error((docs.error || reports.error).message);
  return {
    ...row.details,
    evidence: docs.data.map((d) => ({ name: d.name, text: d.content })),
    report: reports.data?.report || null,
  };
}
