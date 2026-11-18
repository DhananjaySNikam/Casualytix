import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
const pg = await PGlite.create({ extensions: { vector } });
const u = '12b58960-4ee4-4220-875b-38c1b17ebae6',
  v = 'd9c9ca47-136f-4263-809f-9f0f218c998f',
  id = '5f90ffe5-a4cd-42a1-bc16-cdc945934d75';
await pg.exec(
  `create role anon;create role authenticated;create schema auth;create schema extensions;grant usage on schema auth,extensions to authenticated;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;insert into auth.users values('${u}'),('${v}');`,
);
await pg.exec(
  fs.readFileSync(
    new URL('../../supabase/migrations/202611180001_causalytix.sql', import.meta.url),
    'utf8',
  ),
);
await pg.exec(`set role authenticated;set request.jwt.claim.sub='${u}';`);
let payload = {
  id,
  title: 'Diagnosis archive test',
  evidence: [
    {
      name: 'trace.txt',
      text: 'undervoltage',
      chunks: [{ text: 'undervoltage', embedding: Array(256).fill(0.0625) }],
    },
  ],
  report: {
    causes: [
      {
        title: 'Power delivery',
        category: 'Machine',
        why: Array.from({ length: 5 }, (_, i) => ({ text: 'Test ' + i })),
      },
    ],
  },
};
await pg.query('select cx_save_case($1)', [JSON.stringify(payload)]);
const cnt = async (t) => Number((await pg.query('select count(*) n from ' + t)).rows[0].n);
for (const [table, n] of Object.entries({
  cx_incidents: 1,
  cx_evidence_docs: 1,
  cx_document_chunks: 1,
  cx_cause_nodes: 6,
  cx_reports: 1,
}))
  assert.equal(await cnt(table), n);
await pg.exec(`set request.jwt.claim.sub='${v}'`);
assert.equal(await cnt('cx_incidents'), 0);
assert.equal(await cnt('cx_document_chunks'), 0);
await assert.rejects(() =>
  pg.query('insert into cx_incidents(owner_id,id,details) values($1,$2,$3)', [u, id, '{}']),
);
await pg.exec(`set request.jwt.claim.sub='${u}'`);
let bad = structuredClone(payload);
bad.evidence[0].chunks[0].embedding = [0, 1];
await assert.rejects(() => pg.query('select cx_save_case($1)', [JSON.stringify(bad)]));
assert.equal(await cnt('cx_reports'), 1);
payload.evidence = [];
payload.report = null;
await pg.query('select cx_save_case($1)', [JSON.stringify(payload)]);
assert.equal(await cnt('cx_incidents'), 1);
assert.equal(await cnt('cx_document_chunks'), 0);
assert.equal(await cnt('cx_reports'), 0);
await pg.exec('reset role;set role anon;');
await assert.rejects(() => pg.query('select * from cx_incidents'));
await assert.rejects(() => pg.query('select cx_save_case($1)', [JSON.stringify(payload)]));
console.log(
  'Postgres archive: atomic write/update, vector validation, private reads, cross-owner rejection and anonymous denial passed.',
);
await pg.close();
