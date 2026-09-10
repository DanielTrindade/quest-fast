// Simula uma sala com várias pessoas com Playwright: mestre + dois jogadores
// + um não-membro na mesma campanha. Cada contexto de navegador é um usuário
// com seu próprio cookie e a própria conexão WebSocket — então o feed ao vivo,
// a ficha nova aparecendo na mesa e o filtro da rolagem secreta são exercitados
// de verdade, entre clientes, não dentro de uma página só.
//
//   npm run build && npm run db:migrate && npm run db:seed
//   npm run dev                # em outro terminal (porta 3000)
//   npm run verify:group
//
// Um erro de página ou de console reprova o run, exceto o 401 esperado do
// guard enquanto anônimo e a recusa de WebSocket do não-membro.

import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';

const base = process.env.APP_URL || 'http://localhost:3000';
const dbPath = process.env.DB_FILE || 'quest-fast.db';
const channel = existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined;

if (!existsSync(dbPath)) {
  console.error(`Banco não encontrado em ${dbPath}. Rode antes: npm run db:migrate && npm run db:seed`);
  process.exit(2);
}

const db = new Database(dbPath);

function userByDiscord(discordId) {
  const row = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(discordId);
  return row?.id;
}

function createSession(userId) {
  const id = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
  return id;
}

// The seed names the campaign and already seats master + players in it.
const campaign = db.prepare('SELECT id FROM campaigns ORDER BY rowid DESC LIMIT 1').get();
if (!campaign) {
  console.error('Nenhuma campanha encontrada. Rode antes: npm run db:seed');
  process.exit(2);
}

const masterUser = userByDiscord('seed-master');
const rafaelUser = userByDiscord('seed-rafael');
const anaUser = userByDiscord('seed-ana');
if (!masterUser || !rafaelUser || !anaUser) {
  console.error('Usuários do seed ausentes. Rode antes: npm run db:seed');
  process.exit(2);
}

// A non-member: a real user with a session who never joined the campaign.
const outsiderUser = userByDiscord('seed-outsider') ?? (() => {
  db.prepare('INSERT INTO users (id, discord_id, name) VALUES (?, ?, ?)').run(randomUUID(), 'seed-outsider', 'Forasteiro');
  return userByDiscord('seed-outsider');
})();

const members = {
  master: { label: 'mestre', session: createSession(masterUser) },
  rafael: { label: 'Rafael', session: createSession(rafaelUser) },
  ana: { label: 'Ana', session: createSession(anaUser) },
};

const problems = [];
function collectErrors(page, who) {
  page.on('pageerror', (error) => problems.push(`${who}: erro de página: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('401')) return;
    // Every failure path of the non-member is expected: the campaign 404s for
    // them and the socket upgrade is refused. Both are what we assert below.
    if (who === 'não-membro' && /WebSocket|ws:\/\/|404/i.test(message.text())) return;
    problems.push(`${who}: erro de console: ${message.text()}`);
  });
}

const passed = [];
function ok(label) {
  passed.push(label);
  console.log(`OK  ${label}`);
}

const campaignUrl = `${base}/campaigns/${campaign.id}`;

async function openUser(who, session) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'qf_session', value: session, url: base }]);
  const page = await context.newPage();
  collectErrors(page, who);
  await page.goto(campaignUrl, { waitUntil: 'domcontentloaded' });
  return { context, page };
}

const feedRows = (page) => page.locator('.feed-list > li');
const feedCount = async (page) => feedRows(page).count();
const characterCount = async (page) => page.locator('.characters-list > li').count();
const waitForCount = (page, selector, min, label, timeout = 15000) =>
  page
    .waitForFunction(({ selector, min }) => document.querySelectorAll(selector).length >= min, { selector, min }, { timeout })
    .catch(() => {
      throw new Error(`${label} não aconteceu a tempo em ${page.url()}`);
    });

const browser = await chromium.launch({ channel, headless: true });

try {
  // 1) Todos entram na campanha e o feed conecta ao vivo em cada um.
  const master = await openUser('mestre', members.master.session);
  const rafael = await openUser('Rafael', members.rafael.session);
  const ana = await openUser('Ana', members.ana.session);

  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    await page.getByRole('heading', { name: 'Personagens' }).waitFor({ timeout: 15000 });
    await page.locator('.feed-status[data-status="connected"]').waitFor({ timeout: 15000 });
    ok(`${who} abre a campanha com o feed ao vivo`);
  }

  // 2) O não-membro é barrado: a campanha não existe para ele.
  const outsider = await openUser('não-membro', createSession(outsiderUser));
  await outsider.page.getByText('Campanha não encontrada.').waitFor({ timeout: 15000 });
  ok('o não-membro não vê a campanha (404)');

  // 3) Rafael cria um personagem.
  await rafael.page.getByRole('button', { name: 'Novo personagem' }).first().click();
  const dialog = rafael.page.getByRole('dialog');
  await dialog.waitFor({ timeout: 10000 });
  await dialog.getByLabel('Nome').fill('Kaelen');
  await dialog.getByLabel('Raça').fill('Elfo');
  await dialog.getByLabel('Classe').fill('Ladino');
  await dialog.getByRole('button', { name: 'Criar personagem' }).click();
  await rafael.page.getByText('Kaelen', { exact: true }).first().waitFor({ timeout: 15000 });
  ok('Rafael cria a ficha de Kaelen');

  // 4) Rafael rola e a mesa inteira vê na hora, sem recarregar.
  const before = {};
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    before[who] = await feedCount(page);
  }
  await rafael.page.getByLabel('Expressão de dados').fill('1d20+5');
  await rafael.page.getByRole('button', { name: 'Rolar' }).click();
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    await waitForCount(page, '.feed-list > li', before[who] + 1, `${who} recebe a rolagem ao vivo`, 10000);
    await page.getByText('1d20+5').first().waitFor({ timeout: 10000 });
  }
  ok('a rolagem de Rafael chega ao vivo para mestre, Rafael e Ana');

  // 5) O evento da rolagem atualiza a mesa: a ficha nova aparece para todos.
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    await waitForCount(page, '.characters-list > li', 3, `${who} vê a ficha nova`, 10000);
  }
  ok('mestre e jogadores veem a ficha de Kaelen sem recarregar');

  // 6) Rolagem secreta do mestre: só o mestre a vê.
  const rafaelBefore = await feedCount(rafael.page);
  const anaBefore = await feedCount(ana.page);
  await master.page.getByLabel('Expressão de dados').fill('1d20');
  await master.page.getByLabel(/Rolar em segredo/).check();
  await master.page.getByRole('button', { name: 'Rolar' }).click();
  await master.page.locator('.feed-secret-tag').first().waitFor({ timeout: 10000 });
  await new Promise((resolve) => setTimeout(resolve, 900));
  if ((await feedCount(rafael.page)) !== rafaelBefore) throw new Error('Rafael recebeu a rolagem secreta no feed');
  if ((await feedCount(ana.page)) !== anaBefore) throw new Error('Ana recebeu a rolagem secreta no feed');
  if ((await rafael.page.getByText('Secreta').count()) !== 0) throw new Error('Rafael vê o rótulo Secreta');
  ok('a rolagem secreta do mestre não chega aos jogadores');

  // 7) Rolagem linkada à ficha: identifica o personagem na mesa.
  await rafael.page.locator('.character-row').filter({ hasText: 'Kaelen' }).click();
  const sheet = rafael.page.getByRole('dialog');
  await sheet.waitFor({ timeout: 10000 });
  const beforeLinked = {};
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    beforeLinked[who] = await feedCount(page);
  }
  await sheet.getByRole('button', { name: 'Teste' }).first().click();
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    await waitForCount(page, '.feed-list > li', beforeLinked[who] + 1, `${who} recebe a rolagem linkada`, 10000);
    await page.getByText('teste de Força').first().waitFor({ timeout: 10000 });
  }
  ok('a rolagem linkada à ficha de Kaelen aparece para a mesa identificando o personagem');

  // 8) A interface não oferece o que a API recusa: o PATCH é só do dono, então
  //    o mestre consulta a ficha de Kaelen sem receber "Editar".
  await rafael.page.keyboard.press('Escape');
  await rafael.page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 });
  await master.page.locator('.character-row').filter({ hasText: 'Kaelen' }).click();
  const masterSheet = master.page.getByRole('dialog');
  await masterSheet.waitFor({ timeout: 10000 });
  if ((await masterSheet.getByRole('button', { name: 'Editar' }).count()) !== 0) {
    throw new Error('o mestre recebeu "Editar" numa ficha que a API não deixa ele salvar');
  }
  await masterSheet.getByText(/Consulta: só/).waitFor({ timeout: 5000 });
  ok('o mestre consulta a ficha de outro sem receber uma edição que não pode salvar');

  // 9) Excluir é um caminho de dois passos, e desistir não chama a API.
  await masterSheet.getByRole('button', { name: 'Excluir' }).click();
  await masterSheet.getByText('Excluir Kaelen?').waitFor({ timeout: 5000 });
  await masterSheet.getByRole('button', { name: 'Manter ficha' }).click();
  await masterSheet.getByRole('button', { name: 'Excluir', exact: true }).waitFor({ timeout: 5000 });
  if ((await master.page.locator('.character-row').filter({ hasText: 'Kaelen' }).count()) !== 1) {
    throw new Error('a ficha sumiu depois de cancelar a exclusão');
  }
  await master.page.keyboard.press('Escape');
  ok('excluir personagem exige confirmação e desistir preserva a ficha');

  // 10) Consulta e edição ocupam a mesma camada, sem empilhar diálogos.
  await rafael.page.locator('.character-row').filter({ hasText: 'Kaelen' }).click();
  await rafael.page.getByRole('dialog').waitFor({ timeout: 10000 });
  await rafael.page.getByRole('dialog').getByRole('button', { name: 'Editar' }).click();
  await rafael.page.getByRole('heading', { name: 'Editar Kaelen' }).waitFor({ timeout: 10000 });
  const layers = await rafael.page.locator('[role="dialog"]').count();
  if (layers !== 1) throw new Error(`a edição empilhou ${layers} diálogos sobre a ficha`);
  ok('editar substitui a ficha em vez de empilhar um segundo diálogo');

  // 11) Um formulário longo não perde trabalho por um Escape distraído.
  const editor = rafael.page.getByRole('dialog');
  await editor.getByLabel('Nome').fill('Kaelen, o Silencioso');
  await rafael.page.keyboard.press('Escape');
  await editor.getByText('Há alterações que ainda não foram salvas.').waitFor({ timeout: 5000 });
  await editor.getByRole('button', { name: 'Continuar editando' }).click();
  if ((await editor.getByLabel('Nome').inputValue()) !== 'Kaelen, o Silencioso') {
    throw new Error('continuar editando perdeu o que estava digitado');
  }
  await rafael.page.keyboard.press('Escape');
  await editor.getByRole('button', { name: 'Descartar alterações' }).click();
  await rafael.page.getByRole('dialog').getByText(/Atributos/).waitFor({ timeout: 10000 });
  ok('sair de uma edição alterada pede confirmação e volta para a consulta');

  // 12) Nenhum corte nas larguras que a mesa usa — com a ficha aberta inclusive.
  for (const width of [320, 390, 768, 1280]) {
    await rafael.page.setViewportSize({ width, height: 900 });
    const scrollWidth = await rafael.page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth > width) throw new Error(`ficha aberta: overflow em ${width}px (${scrollWidth})`);
  }
  await rafael.page.keyboard.press('Escape');
  await rafael.page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 });
  for (const width of [320, 390, 768, 1280]) {
    await rafael.page.setViewportSize({ width, height: 900 });
    const scrollWidth = await rafael.page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth > width) throw new Error(`campanha: overflow em ${width}px (${scrollWidth})`);
  }
  ok('a campanha e a ficha não cortam conteúdo em 320, 390, 768 e 1280 px');

  // 13) No celular o jogo vem antes da administração da campanha.
  await rafael.page.setViewportSize({ width: 390, height: 844 });
  const dicePanel = await rafael.page.locator('.dice-panel').boundingBox();
  const admin = await rafael.page.locator('.campaign-admin').boundingBox();
  if (!dicePanel || !admin) throw new Error('painel de dados ou administração não encontrados em 390px');
  if (dicePanel.y >= admin.y) {
    throw new Error(`em 390px os dados (y=${Math.round(dicePanel.y)}) ainda vêm depois da administração (y=${Math.round(admin.y)})`);
  }
  ok('em 390px os dados e o histórico vêm antes da administração da campanha');

  await master.context.close();
  await rafael.context.close();
  await ana.context.close();
  await outsider.context.close();
} catch (error) {
  problems.push(error.message);
} finally {
  await browser.close();
  db.close();
}

console.log(`\n${passed.length} verificações aprovadas.`);
if (problems.length) {
  console.error('\nFALHAS:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}
