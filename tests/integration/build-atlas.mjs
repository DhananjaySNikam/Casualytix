/** Reprint the checked-in 11 system diagrams as a portable project-report plate set. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const file = (rel) => fileURLToPath(new URL('../../' + rel, import.meta.url));
const data = JSON.parse(readFileSync(file('src/atlas.json'), 'utf8'));
const embedded = (p, type) =>
  'data:' + type + ';base64,' + readFileSync(file(p)).toString('base64');
const esc = (s) => s.replace(/[&<>]/g, (v) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[v]);
const theme = `@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;color:#17272b;font:14px Arial,sans-serif}section{height:209mm;padding:13mm 15mm 10mm;position:relative;break-after:page}section:last-child{break-after:auto}.rail,footer,.meta{display:flex;justify-content:space-between;align-items:center;font:10px monospace;letter-spacing:1.8px;text-transform:uppercase}.rail{padding-bottom:4mm;border-bottom:1px solid #c1d4cc}.rail b{font:bold 16px Arial;letter-spacing:0}.cover{background:#101d22;color:#e6f7f0}.cover .rail{border-color:#42544e}.intro{position:relative;min-height:75mm;padding-top:15mm}.core{position:absolute;right:0;top:3mm;width:94mm;mix-blend-mode:lighten}.kicker{font:10px monospace;color:#2d8067;letter-spacing:1.8px;text-transform:uppercase}.cover .kicker{color:#77e4be}h1,h2,h3,p{margin:0}h1{font-size:48px;letter-spacing:-1.9px;margin:3mm 0}h2{font-size:32px;letter-spacing:-1px;margin:3mm 0 2mm}.info{font-size:14px;max-width:155mm;line-height:1.6;color:#b9cdc4}.index{border-top:1px solid #42544e;padding-top:6mm}.toc{columns:2;column-gap:20mm;margin-top:3mm;max-width:240mm}.toc div{break-inside:avoid;display:flex;align-items:center;gap:4mm;padding:2mm 0;font-size:13px}.toc b{font:10px monospace;color:#65d6b0}.footnote{margin-top:6mm;color:#a3b9af;font-size:11px}.caption{font-size:13px;color:#4c6363;line-height:1.5;max-width:250mm}.plate{display:flex;align-items:center;justify-content:center;width:100%;height:127mm;margin-top:6mm;background-color:#121c22;background-image:radial-gradient(#274148 .5px,transparent .6px);background-size:12px 12px;border-radius:5px;padding:7mm}.plate img{width:100%;height:100%;object-fit:contain}footer{position:absolute;bottom:9mm;left:15mm;right:15mm;color:#728983;font-size:8px}.fig-title{margin-top:6mm}`;
const cover = `<section class="cover"><div class="rail"><b>Causalytix</b><span>Engineering documentation / V1.0</span></div><div class="intro"><img alt="Inference core" class="core" src="${embedded('public/assets/inference-core.webp', 'image/webp')}"><div class="kicker">Project report companion</div><h1>System diagram atlas.</h1><p class="info">An engineering reference for evidence-linked root cause analysis.<br>Software and hardware incidents, from input to verification.</p></div><div class="index"><div class="kicker">Figure index / 11 plates</div><div class="toc">${data.map((d) => `<div><b>${d.id.slice(0, 2)}</b>${esc(d.title)}</div>`).join('')}</div></div><p class="footnote">Companion to the CAUSALYTIX System Design Specification · Nutan College of Engineering and Research.</p><footer><span>Diagnostic platform / Engineering edition</span><span>Atlas · 2026</span></footer></section>`;
const figs = data
  .map(
    (d) =>
      `<section><div class="rail"><b>Causalytix</b><span>Project report / Diagram atlas</span></div><div class="fig-title"><span class="kicker">Fig. ${d.id.slice(0, 2)} / ${esc(d.group)}</span><h2>${esc(d.title)}</h2><p class="caption">${esc(d.description)}</p></div><div class="plate"><img src="${embedded('public/assets/atlas/' + d.id + '.svg', 'image/svg+xml')}" alt="${esc(d.title)} diagram"></div><footer><span>Causalytix / System engineering</span><span>Figure ${d.id.slice(0, 2)} of 11</span></footer></section>`,
  )
  .join('');
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
});
try {
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><html lang="en"><head><title>Causalytix — System diagram atlas</title><style>${theme}</style></head><body>${cover}${figs}</body></html>`,
    { waitUntil: 'load' },
  );
  await page.pdf({
    path: file('public/assets/causalytix-diagram-atlas.pdf'),
    printBackground: true,
    preferCSSPageSize: true,
  });
} finally {
  await browser.close();
}
