// Smoke check of the phase 0 flows, and the combat section of the seed
// campaign, against a running server, in a real browser. It exists because a crash inside the create-campaign dialog shipped
// unnoticed: the API was fine and the screens rendered, but no check had ever
// opened a dialog that mounts a form.
//
//   npm run build && npm run dev      # in another terminal
//   npm run db:seed                   # prints the session cookie
//   npm run verify:app <session>
//
// A page error or a console error fails the run, except the expected 401 the
// route guard triggers while anonymous.

import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const base = process.env.APP_URL || 'http://localhost:3000';
const session = process.argv[2];
if (!session) {
  console.error('Informe o cookie de sessão: npm run verify:app <qf_session>');
  process.exit(2);
}

const channel = process.env.PLAYWRIGHT_CHANNEL || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);
const browser = await chromium.launch({ channel, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const problems = [];
page.on('pageerror', (error) => problems.push(`erro de página: ${error.message}`));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  // The guard fetches /api/auth/me while anonymous; the 401 is by design.
  if (message.text().includes('401')) return;
  problems.push(`erro de console: ${message.text()}`);
});

const passed = [];
function ok(label) {
  passed.push(label);
  console.log(`OK  ${label}`);
}

try {
  // 1) Anonymous: the guard sends the browser to the login screen.
  await page.goto(`${base}/campaigns`);
  await page.waitForURL('**/login*', { timeout: 15000 });
  await page.getByRole('link', { name: /Entrar com o Discord/i }).waitFor({ timeout: 10000 });
  ok('anônimo é levado ao login');

  await context.addCookies([{ name: 'qf_session', value: session, url: base }]);

  // 2) Campaign listing.
  await page.goto(`${base}/campaigns`);
  await page.getByRole('heading', { name: 'Campanhas' }).waitFor({ timeout: 15000 });
  ok('listagem de campanhas carrega');

  // 3) Create-campaign dialog: mounts a form and completes the round trip.
  const uniqueName = `Verificação ${Date.now()}`;
  await page.getByRole('button', { name: 'Criar campanha' }).first().click();
  const createDialog = page.getByRole('dialog');
  await createDialog.waitFor({ timeout: 10000 });
  ok('diálogo de criar campanha abre sem quebrar');

  await createDialog.getByRole('textbox').first().fill(uniqueName);
  await createDialog.getByRole('textbox').nth(1).fill('Criada pela verificação automática.');
  await createDialog.getByRole('button', { name: 'Criar campanha' }).click();
  await page.getByText(uniqueName).waitFor({ timeout: 15000 });
  ok('campanha criada aparece na listagem');

  // 4) The new campaign opens; its Players screen has the members and the invite.
  await page.getByText(uniqueName).click();
  await page.getByRole('link', { name: 'Jogadores', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Membros' }).waitFor({ timeout: 15000 });
  const members = await page.locator('[data-slot="member-name"]').allTextContents();
  if (members.length !== 1) throw new Error(`campanha nova deveria ter 1 membro, tem ${members.length}`);
  ok(`campanha abre com o mestre como único membro (${members[0]})`);

  await page.getByRole('button', { name: 'Convidar jogadores' }).first().click();
  const inviteDialog = page.getByRole('dialog');
  await inviteDialog.waitFor({ timeout: 10000 });
  const inviteLink = await inviteDialog.locator('input[readonly]').first().inputValue();
  if (!/\/invite\/[A-Z2-9]{6}$/.test(inviteLink)) throw new Error(`link de convite inesperado: ${inviteLink}`);
  ok('link de convite visível ao mestre');
  await page.keyboard.press('Escape');

  // 5) Join dialog: also mounts a form, and rejects a malformed code.
  await page.goto(`${base}/campaigns`);
  await page.getByRole('button', { name: 'Entrar com código' }).first().click();
  const joinDialog = page.getByRole('dialog');
  await joinDialog.waitFor({ timeout: 10000 });
  ok('diálogo de entrar com código abre sem quebrar');

  await joinDialog.getByRole('textbox').first().fill('ABC');
  await joinDialog.getByText('Código incompleto ou com caractere inválido.').waitFor({ timeout: 5000 });
  ok('código malformado é recusado antes do envio');

  await page.keyboard.press('Escape');

  // 6) No horizontal overflow at the widths the table actually uses.
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth > width) throw new Error(`overflow horizontal em ${width}px: ${scrollWidth}`);
  }
  ok('sem overflow horizontal em 320/390/768/1280');

  // 7) Prep in the seed campaign, read-only: `verify:group` runs the
  //    fight on the same encounter, so this leaves it in preparation.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/campaigns`);
  await page.getByText('Ecos de Phandalin').first().click();
  await page.getByRole('link', { name: 'Preparo', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Encontros' }).first().waitFor({ timeout: 15000 });
  await page.getByRole('list', { name: 'Criaturas do bestiário' }).getByText('Goblin xamã').waitFor({ timeout: 15000 });
  ok('o Preparo do mestre abre com o bestiário do seed');

  await page.getByRole('button', { name: 'Adicionar criatura' }).first().click();
  const statblockDialog = page.getByRole('dialog');
  await statblockDialog.waitFor({ timeout: 10000 });
  ok('o diálogo de nova criatura abre sem quebrar');
  await page.keyboard.press('Escape');
  await statblockDialog.waitFor({ state: 'detached', timeout: 10000 });

  await page.getByRole('list', { name: 'Encontros' }).getByRole('button', { name: /Emboscada na estrada/ }).click();
  await page.getByRole('button', { name: 'Iniciar combate' }).waitFor({ timeout: 15000 });
  const queue = page.getByRole('list', { name: 'Ordem de iniciativa' });
  for (const name of ['Elara Sombravil', 'Bram Linha Longa', 'Goblin 1', 'Goblin 2', 'Lobo']) {
    await queue.getByText(name, { exact: true }).first().waitFor({ timeout: 10000 });
  }
  ok('o encontro do seed abre em preparação, com personagens e criaturas');

  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth > width) throw new Error(`encontro aberto: overflow em ${width}px (${scrollWidth})`);
  }
  ok('o encontro não corta conteúdo em 320/390/768/1280');
} catch (error) {
  problems.push(error.message);
} finally {
  await browser.close();
}

console.log(`\n${passed.length} verificações aprovadas.`);
if (problems.length) {
  console.error('\nFALHAS:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}
