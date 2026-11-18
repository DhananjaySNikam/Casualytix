const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH });
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:5173');
  await p.getByRole('heading', { name: 'Workspace overview' }).waitFor();
  await p.evaluate(() => document.fonts.ready);
  await p.getByRole('button', { name: 'View pipeline', exact: true }).click();
  await p.getByRole('dialog', { name: 'The diagnostic pipeline' }).waitFor();
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'New investigation', exact: true }).click();
  await p.getByRole('button', { name: /Hardware Devices/ }).click();
  await p.getByLabel('Incident title').fill('Controller resets at startup');
  await p
    .getByLabel('Problem description')
    .fill(
      'The sensor board resets after a voltage drop when the motor starts. Brownouts are recorded at peak load.',
    );
  await p.getByLabel('Affected system').fill('Field controller');
  await p.getByRole('button', { name: 'Continue', exact: true }).last().click();
  await p.getByRole('button', { name: 'Paste a note' }).click();
  await p.getByLabel('Source name').fill('Service bench note');
  await p
    .getByLabel('Observation or design excerpt')
    .fill('Power supply voltage drops under transient load. Undervoltage reset at 4.2 V.');
  await p.getByRole('button', { name: 'Attach note' }).click();
  await p.locator('input[type=file]').setInputFiles({
    name: 'power.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('event,voltage\nidle,5.0\nload,4.2'),
  });
  await p.getByText('power.csv', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Continue', exact: true }).click();
  await p.getByRole('button', { name: 'Run analysis' }).click();
  await p.getByRole('heading', { name: 'Ranked hypotheses' }).waitFor();
  console.log('Created:', await p.locator('h1').innerText());
  await p.getByRole('button', { name: 'Causal map', exact: true }).click();
  await p.getByRole('group', { name: 'Interactive Ishikawa cause and effect diagram' }).waitFor();
  await p.getByRole('button', { name: 'Follow 5-Why chain' }).click();
  await p.locator('.why-node').first().waitFor();
  assert.equal(await p.locator('.why-node').count(), 5);
  await p.getByRole('button', { name: 'Solutions', exact: true }).click();
  await p.getByRole('heading', { name: 'Verification test' }).waitFor();
  await p.getByRole('button', { name: 'Mark resolved', exact: true }).click();
  await p
    .getByLabel('Verification result')
    .fill('An approved supply restored voltage under the same load; there were no resets.');
  await p.getByRole('button', { name: 'Confirm resolution' }).click();
  await p.getByText('Resolved', { exact: true }).waitFor();
  await p.getByRole('button', { name: 'Export report' }).click();
  const wait = p.waitForEvent('download');
  await p.getByRole('link', { name: /PDF report/ }).click();
  const pdf = await wait;
  console.log('Downloaded:', pdf.suggestedFilename());
  await p.keyboard.press('Escape');
  await p.reload();
  await p.getByRole('heading', { name: 'Controller resets at startup' }).waitFor();
  await p.getByRole('link', { name: 'Evidence vault' }).click();
  await p.getByRole('textbox', { name: 'Search Evidence vault' }).fill('power.csv');
  assert.equal(await p.locator('.record-row').count(), 1);
  await p.locator('.record-row').click();
  await p.getByText('event,voltage', { exact: false }).first().waitFor();
  await p.keyboard.press('Control+k');
  await p.getByRole('textbox', { name: 'Search workspace' }).fill('Diagram library');
  await p.keyboard.press('Enter');
  await p.getByRole('heading', { name: 'Diagram library' }).waitFor();
  await p.getByRole('button', { name: /Component architecture/ }).click();
  await p.getByRole('dialog').waitFor();
  assert(await p.locator('.atlas-large img').evaluate((im) => im.complete && im.naturalWidth > 0));
  await p.keyboard.press('Escape');
  await p.getByRole('link', { name: 'System settings', exact: true }).click();
  await p.getByRole('heading', { name: 'Supabase archive' }).waitFor();
  await p.getByRole('button', { name: 'Create account', exact: true }).click();
  await p.getByRole('button', { name: 'Create cloud account' }).waitFor();
  await p.getByRole('link', { name: 'Overview', exact: true }).click();
  await p.setViewportSize({ width: 390, height: 844 });
  await p.reload();
  await p.getByRole('heading', { name: 'Workspace overview' }).waitFor();
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth), 390);
  await p.getByRole('button', { name: 'Toggle navigation' }).click();
  await p.getByRole('link', { name: 'Investigations', exact: false }).first().click();
  await p.getByRole('heading', { name: 'Investigations', exact: true }).waitFor();
  console.log('All flow assertions passed; browser errors:', errors);
  assert.equal(errors.length, 0);
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
