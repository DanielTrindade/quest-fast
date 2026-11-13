// Simula uma sala com várias pessoas com Playwright: mestre + dois jogadores
// + um não-membro na mesma campanha. Cada contexto de navegador é um usuário
// com seu próprio cookie e a própria conexão WebSocket — então o feed ao vivo,
// a ficha nova aparecendo na mesa e o filtro da rolagem secreta são exercitados
// de verdade, entre clientes, não dentro de uma página só. No fim, a mesa roda
// o combate do seed ("Emboscada na estrada") de ponta a ponta.
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
const channel = process.env.PLAYWRIGHT_CHANNEL || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);

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

// The seed names the campaign and already seats master + players in it. By
// name: `verify:app` creates campaigns of its own in the same database.
const campaign = db.prepare("SELECT id FROM campaigns WHERE name = 'Ecos de Phandalin' ORDER BY rowid DESC LIMIT 1").get();
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
// Requests this script makes on purpose to see them refused (403/404).
const probes = new Set();
function collectErrors(page, who) {
  page.on('pageerror', (error) => problems.push(`${who}: erro de página: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    if (message.text().includes('401')) return;
    if (probes.has(message.location()?.url ?? '')) return;
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
// The game is played at the table; the overview and the players screen are
// other routes of the same campaign.
const tableUrl = `${campaignUrl}/table`;

async function openUser(who, session) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([{ name: 'qf_session', value: session, url: base }]);
  const page = await context.newPage();
  collectErrors(page, who);
  await page.goto(tableUrl, { waitUntil: 'domcontentloaded' });
  return { context, page };
}

const feedRows = (page) => page.locator('[data-slot="feed-list"] > li');
const feedCount = async (page) => feedRows(page).count();
const characterCount = async (page) => page.locator('[data-slot="characters-list"] > li').count();
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
    await page.locator('[data-slot="feed-status"][data-status="connected"]').waitFor({ timeout: 15000 });
    ok(`${who} abre a campanha com o feed ao vivo`);
  }

  // 2) O não-membro é barrado: a campanha não existe para ele.
  const outsider = await openUser('não-membro', createSession(outsiderUser));
  await outsider.page.getByText('Campanha não encontrada.').waitFor({ timeout: 15000 });
  ok('o não-membro não vê a campanha (404)');

  // 3) Rafael cria o personagem em Meus personagens, escolhendo a campanha,
  //    e o leva à mesa: é o ativo dele nesta campanha.
  const gallery = await rafael.context.newPage();
  collectErrors(gallery, 'Rafael (galeria)');
  await gallery.goto(`${base}/characters`, { waitUntil: 'domcontentloaded' });
  await gallery.getByRole('heading', { name: 'Meus personagens' }).waitFor({ timeout: 15000 });
  await gallery.getByRole('button', { name: /Novo personagem|Criar personagem/ }).first().click();
  await gallery.getByRole('dialog').getByLabel('Campanha').selectOption(campaign.id);
  await gallery.getByRole('dialog').getByRole('button', { name: 'Continuar' }).click();
  const dialog = gallery.getByRole('dialog');
  await dialog.getByLabel('Nome do personagem').waitFor({ timeout: 10000 });
  await dialog.getByLabel('Nome do personagem').fill('Kaelen');
  await dialog.getByLabel('Espécie').fill('Elfo');
  await dialog.getByRole('textbox', { name: 'Classe', exact: true }).fill('Ladino');
  await dialog.getByRole('button', { name: 'Criar personagem' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 15000 });
  const kaelenSlot = gallery.getByRole('radio', { name: /^Kaelen, Ladino/ }).last();
  await kaelenSlot.click();
  const showcase = gallery.locator('[data-slot="character-showcase"]');
  await showcase.getByRole('heading', { name: 'Kaelen' }).waitFor({ timeout: 10000 });
  // A rerun on the same database finds an older Kaelen already active.
  const activateButton = showcase.getByRole('button', { name: 'Ativar nesta campanha' });
  if (await activateButton.count()) await activateButton.click();
  await showcase.getByText('Ativo na mesa').waitFor({ timeout: 10000 });
  ok('Rafael cria a ficha de Kaelen em Meus personagens e ela fica ativa na campanha');

  // 3b) Fora da mesa a ficha é só para ver: sem botões de rolar.
  await showcase.getByRole('button', { name: 'Abrir ficha' }).click();
  const gallerySheet = gallery.getByRole('dialog');
  await gallerySheet.getByText(/Atributos/).first().waitFor({ timeout: 10000 });
  if ((await gallerySheet.getByRole('button', { name: 'Teste' }).count()) !== 0) {
    throw new Error('a ficha aberta fora da mesa oferece rolagem');
  }
  if ((await gallerySheet.getByRole('button', { name: 'Dano' }).count()) !== 0) {
    throw new Error('a ficha aberta fora da mesa altera os pontos de vida');
  }
  ok('a ficha aberta em Meus personagens não rola dados nem muda o estado da sessão');

  // 3c) A mesa do mestre já aberta recebe o personagem ativo pelo socket, sem
  //     depender de rolagem, combate ou recarga.
  await master.page.locator('[data-slot="character-row"]').filter({ hasText: 'Kaelen' }).first().waitFor({ timeout: 10000 });
  ok('a mesa do mestre mostra Kaelen assim que Rafael o ativa, sem recarregar');

  // 4) Rafael rola e a mesa inteira vê na hora, sem recarregar.
  const before = {};
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    before[who] = await feedCount(page);
  }
  await rafael.page.getByLabel('Expressão de dados').fill('1d20+5');
  await rafael.page.getByRole('button', { name: 'Rolar' }).click();
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    await waitForCount(page, '[data-slot="feed-list"] > li', before[who] + 1, `${who} recebe a rolagem ao vivo`, 10000);
    await page.getByText('1d20+5').first().waitFor({ timeout: 10000 });
  }
  ok('a rolagem de Rafael chega ao vivo para mestre, Rafael e Ana');

  // 5) O evento da rolagem atualiza a mesa: a ficha nova aparece para todos.
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    await waitForCount(page, '[data-slot="characters-list"] > li', 3, `${who} vê a ficha nova`, 10000);
  }
  ok('mestre e jogadores veem a ficha de Kaelen sem recarregar');

  // 6) Rolagem secreta do mestre: só o mestre a vê.
  const rafaelBefore = await feedCount(rafael.page);
  const anaBefore = await feedCount(ana.page);
  await master.page.getByLabel('Expressão de dados').fill('1d20');
  await master.page.getByLabel(/Rolar em segredo/).check();
  await master.page.getByRole('button', { name: 'Rolar' }).click();
  await master.page.locator('[data-slot="secret-tag"]').first().waitFor({ timeout: 10000 });
  await new Promise((resolve) => setTimeout(resolve, 900));
  if ((await feedCount(rafael.page)) !== rafaelBefore) throw new Error('Rafael recebeu a rolagem secreta no feed');
  if ((await feedCount(ana.page)) !== anaBefore) throw new Error('Ana recebeu a rolagem secreta no feed');
  if ((await rafael.page.getByText('Secreta').count()) !== 0) throw new Error('Rafael vê o rótulo Secreta');
  ok('a rolagem secreta do mestre não chega aos jogadores');

  // 7) Rolagem linkada à ficha: identifica o personagem na mesa.
  await rafael.page.locator('[data-slot="character-row"]').filter({ hasText: 'Kaelen' }).click();
  const sheet = rafael.page.getByRole('dialog');
  await sheet.waitFor({ timeout: 10000 });
  const beforeLinked = {};
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    beforeLinked[who] = await feedCount(page);
  }
  await sheet.getByRole('button', { name: 'Teste' }).first().click();
  for (const [who, { page }] of Object.entries({ master: master, rafael: rafael, ana: ana })) {
    await waitForCount(page, '[data-slot="feed-list"] > li', beforeLinked[who] + 1, `${who} recebe a rolagem linkada`, 10000);
    await page.getByText('teste de Força').first().waitFor({ timeout: 10000 });
  }
  ok('a rolagem linkada à ficha de Kaelen aparece para a mesa identificando o personagem');

  // 8) A interface não oferece o que a API recusa: o PATCH é só do dono, então
  //    o mestre consulta a ficha de Kaelen sem receber "Editar".
  await rafael.page.keyboard.press('Escape');
  await rafael.page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 });
  await master.page.locator('[data-slot="character-row"]').filter({ hasText: 'Kaelen' }).click();
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
  if ((await master.page.locator('[data-slot="character-row"]').filter({ hasText: 'Kaelen' }).count()) !== 1) {
    throw new Error('a ficha sumiu depois de cancelar a exclusão');
  }
  await master.page.keyboard.press('Escape');
  ok('excluir personagem exige confirmação e desistir preserva a ficha');

  // 10) Consulta e edição ocupam a mesma camada, sem empilhar diálogos. A
  //     edição mora em Meus personagens; na mesa o dono só joga.
  await rafael.page.locator('[data-slot="character-row"]').filter({ hasText: 'Kaelen' }).click();
  await rafael.page.getByRole('dialog').getByText(/Atributos/).first().waitFor({ timeout: 10000 });
  if ((await rafael.page.getByRole('dialog').getByRole('button', { name: 'Editar' }).count()) !== 0) {
    throw new Error('a mesa oferece editar a ficha, que agora mora em Meus personagens');
  }
  await gallerySheet.getByRole('button', { name: 'Editar' }).click();
  await gallery.getByRole('heading', { name: 'Editar Kaelen' }).waitFor({ timeout: 10000 });
  const layers = await gallery.locator('[role="dialog"]').count();
  if (layers !== 1) throw new Error(`a edição empilhou ${layers} diálogos sobre a ficha`);
  ok('editar substitui a ficha em vez de empilhar um segundo diálogo, e a mesa não oferece edição');

  // 11) Um formulário longo não perde trabalho por um Escape distraído.
  const editor = gallery.getByRole('dialog');
  await editor.getByLabel('Nome do personagem').fill('Kaelen, o Silencioso');
  await gallery.keyboard.press('Escape');
  await editor.getByText('Há alterações que ainda não foram salvas.').waitFor({ timeout: 5000 });
  await editor.getByRole('button', { name: 'Continuar editando' }).click();
  if ((await editor.getByLabel('Nome do personagem').inputValue()) !== 'Kaelen, o Silencioso') {
    throw new Error('continuar editando perdeu o que estava digitado');
  }
  await gallery.keyboard.press('Escape');
  await editor.getByRole('button', { name: 'Descartar alterações' }).click();
  await gallery.getByRole('dialog').getByText(/Atributos/).first().waitFor({ timeout: 10000 });
  ok('sair de uma edição alterada pede confirmação e volta para a consulta');

  // 11b) A galeria não corta conteúdo, com e sem a ficha aberta.
  for (const width of [320, 390, 768, 1280]) {
    await gallery.setViewportSize({ width, height: 900 });
    const scrollWidth = await gallery.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth > width) throw new Error(`Meus personagens com a ficha aberta: overflow em ${width}px (${scrollWidth})`);
  }
  await gallery.keyboard.press('Escape');
  await gallery.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 });
  for (const width of [320, 390, 768, 1280]) {
    await gallery.setViewportSize({ width, height: 900 });
    const scrollWidth = await gallery.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth > width) throw new Error(`Meus personagens: overflow em ${width}px (${scrollWidth})`);
  }
  await gallery.close();
  ok('Meus personagens não corta conteúdo em 320, 390, 768 e 1280 px');

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

  // 13) A mesa é só jogo: a administração mora na tela Jogadores.
  await rafael.page.setViewportSize({ width: 390, height: 844 });
  if (!(await rafael.page.locator('[data-slot="dice-panel"]').isVisible())) throw new Error('em 390px a mesa não mostra os dados');
  if ((await rafael.page.locator('[data-slot="campaign-admin"]').count()) !== 0) throw new Error('a mesa ainda mostra a administração da campanha');
  await rafael.page.getByRole('link', { name: 'Jogadores', exact: true }).first().click();
  await rafael.page.locator('[data-slot="campaign-admin"]').waitFor({ timeout: 10000 });
  if ((await rafael.page.getByRole('link', { name: 'Preparo', exact: true }).count()) !== 0) throw new Error('o menu do jogador oferece o Preparo');
  await rafael.page.goto(`${campaignUrl}/prep`, { waitUntil: 'domcontentloaded' });
  await rafael.page.getByText('Esta página não existe').waitFor({ timeout: 10000 });
  if ((await rafael.page.getByText('Bestiário').count()) !== 0) throw new Error('o jogador vê o bestiário no Preparo');
  await rafael.page.goto(tableUrl, { waitUntil: 'domcontentloaded' });
  await rafael.page.locator('[data-slot="feed-status"][data-status="connected"]').waitFor({ timeout: 15000 });
  ok('em 390px a mesa mostra os dados, a administração fica em Jogadores e o Preparo não existe para o jogador');

  // 14) Combate: o encontro em preparação não existe para os jogadores.
  await rafael.page.setViewportSize({ width: 1280, height: 900 });
  const encounter = db.prepare("SELECT id FROM encounters WHERE campaign_id = ? AND name = 'Emboscada na estrada'").get(campaign.id);
  if (!encounter) throw new Error('o seed não criou o encontro "Emboscada na estrada"');
  const encounterApi = `/api/campaigns/${campaign.id}/encounters/${encounter.id}`;
  const status = (page, path) => {
    probes.add(`${base}${path}`);
    return page.evaluate((url) => fetch(url).then((response) => response.status), path);
  };
  if ((await status(ana.page, encounterApi)) !== 404) throw new Error('Ana vê o encontro em preparação');
  if ((await status(outsider.page, encounterApi)) !== 404) throw new Error('o não-membro vê o encontro');
  if ((await ana.page.getByText('Emboscada na estrada').count()) !== 0) throw new Error('Ana vê o nome do encontro em preparação');
  ok('o encontro em preparação não existe para os jogadores nem para o não-membro (404)');

  // 15) O mestre põe Kaelen no encontro, inicia e rola as criaturas; cada
  //     jogador rola a própria iniciativa, e a fila chega a todos.
  const kaelen = db.prepare("SELECT id FROM characters WHERE campaign_id = ? AND name LIKE 'Kaelen%'").get(campaign.id);
  const added = await master.page.evaluate(
    ([url, characterId]) =>
      fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'character', characterId }) }).then((r) => r.status),
    [`${encounterApi}/combatants`, kaelen.id],
  );
  if (added !== 201) throw new Error(`o mestre não conseguiu pôr Kaelen no encontro (${added})`);
  // The encounter is prepared and started in Prep; the fight is run at the table.
  await master.page.getByRole('link', { name: 'Preparo', exact: true }).first().click();
  await master.page.getByRole('list', { name: 'Encontros' }).getByRole('button', { name: /Emboscada na estrada/ }).click();
  await master.page.getByRole('button', { name: 'Iniciar combate' }).click();
  await master.page.getByRole('button', { name: 'Rolar iniciativa das criaturas' }).waitFor({ timeout: 15000 });
  await master.page.getByRole('link', { name: /^Mesa/ }).first().click();
  await master.page.locator('[data-slot="feed-status"][data-status="connected"]').waitFor({ timeout: 15000 });
  await master.page.getByRole('button', { name: 'Rolar iniciativa das criaturas' }).click();
  await master.page.getByRole('button', { name: 'Rolar iniciativa de Bram Linha Longa' }).click();
  for (const { page } of [rafael, ana]) {
    await page.getByRole('list', { name: 'Ordem de iniciativa' }).waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Rolar iniciativa', exact: true }).click();
  }
  await master.page.getByRole('button', { name: 'Começar round 1' }).click({ timeout: 15000 });
  for (const { page } of [master, rafael, ana]) {
    await page.getByText(/Round 1/i).first().waitFor({ timeout: 15000 });
  }
  ok('o mestre inicia, os jogadores rolam a própria iniciativa e a fila chega a todos ao vivo');

  // Abre o painel de ataques de um combatente e escolhe o alvo.
  async function aim(page, attacker, target) {
    const panel = page.locator('details').filter({ has: page.locator('summary', { hasText: new RegExp(`^\\s*Ataques\\s*de ${attacker}\\s*$`) }) });
    if (!(await panel.evaluate((element) => element.open))) await panel.locator('summary').click();
    const select = panel.getByLabel(`Alvo de ${attacker}`);
    // The label carries hit points or the health band; the name starts it.
    const value = await select.evaluate((element, name) => [...element.options].find((option) => option.text.startsWith(`${name} — `))?.value, target);
    if (!value) throw new Error(`${target} não está entre os alvos de ${attacker}`);
    await select.selectOption(value);
    return panel;
  }
  const lastFeedText = (page) => feedRows(page).last().innerText();

  // 16) Ataque secreto do mestre: nada chega aos jogadores.
  const rafaelCount = await feedCount(rafael.page);
  const anaCount = await feedCount(ana.page);
  const masterCount = await feedCount(master.page);
  const goblin = await aim(master.page, 'Goblin 1', 'Kaelen');
  if (!(await goblin.getByRole('checkbox', { name: /Atacar em segredo/ }).isChecked())) throw new Error('o ataque do goblin não começou secreto');
  await goblin.getByRole('button', { name: 'Atacar com Cimitarra' }).click();
  await waitForCount(master.page, '[data-slot="feed-list"] > li', masterCount + 1, 'o mestre recebe o próprio ataque', 10000);
  await new Promise((resolve) => setTimeout(resolve, 900));
  if ((await feedCount(rafael.page)) !== rafaelCount) throw new Error('Rafael recebeu o ataque secreto');
  if ((await feedCount(ana.page)) !== anaCount) throw new Error('Ana recebeu o ataque secreto');
  if ((await rafael.page.getByText(/Dano pendente/).count()) !== 0) throw new Error('Rafael vê o dano pendente de um ataque secreto');
  ok('o ataque secreto do mestre e o dano que ele deixa não chegam aos jogadores');

  // 17) Ataque público do goblin: os jogadores leem totais, nunca o bônus.
  await goblin.getByRole('checkbox', { name: /Atacar em segredo/ }).uncheck();
  await goblin.getByRole('button', { name: 'Atacar com Cimitarra' }).click();
  for (const [who, page, before] of [['Rafael', rafael.page, rafaelCount], ['Ana', ana.page, anaCount]]) {
    await waitForCount(page, '[data-slot="feed-list"] > li', before + 1, `${who} recebe o ataque público`, 10000);
    const text = await lastFeedText(page);
    if (!/Goblin 1 atacou Kaelen com Cimitarra/.test(text)) throw new Error(`${who} leu o ataque como: ${text}`);
    if (/1d20|\+ 4|1d6/.test(text)) throw new Error(`${who} vê os números do goblin: ${text}`);
  }
  ok('o ataque público do goblin chega aos jogadores só com acerto, crítico e dano');

  // 18) Ana ataca um goblin com Elara: só o mestre lê a CA, e um acerto deixa
  //     o dano pendente, que só o mestre resolve.
  // Each browser gets the attack on its own socket: every one waits for it, and
  // reads it only once its last event is this attack, not the goblin's before.
  const elaraAttack = /Elara Sombravil atacou Goblin 2 com Adaga/;
  const table = [['mestre', master.page], ['Rafael', rafael.page], ['Ana', ana.page]];
  let hit = false;
  let masterText = '';
  for (let tries = 0; tries < 12 && !hit; tries++) {
    const counts = await Promise.all(table.map(([, page]) => feedCount(page)));
    const elara = await aim(ana.page, 'Elara Sombravil', 'Goblin 2');
    await elara.getByRole('button', { name: 'Atacar com Adaga' }).click();
    for (const [index, [who, page]] of table.entries()) {
      await waitForCount(page, '[data-slot="feed-list"] > li', counts[index] + 1, `${who} recebe o ataque de Elara`, 10000);
    }
    const anaText = await lastFeedText(ana.page);
    masterText = await lastFeedText(master.page);
    if (!elaraAttack.test(anaText) || !elaraAttack.test(masterText)) {
      throw new Error(`o último evento não é o ataque de Elara: Ana leu "${anaText}", o mestre "${masterText}"`);
    }
    if (/CA \d/.test(anaText)) throw new Error(`Ana vê a CA do goblin: ${anaText}`);
    hit = /Acertou/.test(anaText);
  }
  if (!hit) throw new Error('Elara não acertou o goblin em 12 tentativas');
  if (!/Acertou \(CA 15\)/.test(masterText)) throw new Error(`o mestre não lê a CA do goblin no acerto: ${masterText}`);
  await master.page.getByRole('button', { name: 'Aplicar o dano em Goblin 2' }).waitFor({ timeout: 10000 });
  if ((await ana.page.getByRole('button', { name: /Aplicar o dano/ }).count()) !== 0) throw new Error('Ana recebeu o botão de aplicar dano');
  ok('o ataque de Elara compara com a CA no servidor e só o mestre vê a CA e o dano pendente');

  // 19) O mestre aplica o dano: os jogadores veem a faixa de saúde, não os PV.
  await master.page.getByRole('button', { name: 'Aplicar o dano em Goblin 2' }).click();
  await master.page.getByRole('button', { name: 'Aplicar o dano em Goblin 2' }).waitFor({ state: 'detached', timeout: 10000 });
  // The card whose name is exactly this one: other cards mention it in their target lists.
  const cardText = (page, name) =>
    page.evaluate(
      (wanted) => [...document.querySelectorAll('[aria-label="Ordem de iniciativa"] > li')].find((row) => row.querySelector('p')?.textContent === wanted)?.innerText ?? '',
      name,
    );
  for (const [who, page] of [['Rafael', rafael.page], ['Ana', ana.page]]) {
    await page.waitForFunction(
      () => {
        const row = [...document.querySelectorAll('[aria-label="Ordem de iniciativa"] > li')].find((li) => li.querySelector('p')?.textContent === 'Goblin 2');
        return row && /Ferido|Muito ferido|Derrotado/.test(row.innerText);
      },
      null,
      { timeout: 10000 },
    ).catch(() => {
      throw new Error(`${who} não viu a faixa de saúde do goblin mudar`);
    });
    if (/\d+\s*\/\s*7/.test(await cardText(page, 'Goblin 2'))) throw new Error(`${who} vê os PV do goblin`);
  }
  ok('o dano aplicado pelo mestre chega aos jogadores só como faixa de saúde');

  // 20) Ana não ataca com o personagem de Rafael, nem pela interface nem pela API.
  if ((await ana.page.getByText('Ataques de Kaelen').count()) !== 0) throw new Error('Ana recebeu o painel de ataques de Kaelen');
  const kaelenCombatant = db.prepare('SELECT id FROM combatants WHERE encounter_id = ? AND character_id = ?').get(encounter.id, kaelen.id);
  probes.add(`${base}${encounterApi}/combatants/${kaelenCombatant.id}/attack`);
  const refused = await ana.page.evaluate(
    (url) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ attackIndex: 0 }) }).then((r) => r.status),
    `${encounterApi}/combatants/${kaelenCombatant.id}/attack`,
  );
  if (refused !== 403) throw new Error(`Ana atacou com Kaelen (${refused})`);
  ok('Ana não ataca com o personagem de Rafael (403)');

  // 21) Rafael encerra o próprio turno quando chega a vez de Kaelen.
  const kaelenActive = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('[aria-label="Ordem de iniciativa"] > li')].some(
        (row) => row.getAttribute('aria-current') === 'step' && row.querySelector('p')?.textContent === 'Kaelen',
      ),
    );
  for (let turns = 0; turns < 8 && !(await kaelenActive(rafael.page)); turns++) {
    await master.page.getByRole('button', { name: /Próximo turno/ }).click();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!(await kaelenActive(rafael.page))) throw new Error('a vez de Kaelen não chegou');
  await rafael.page.getByRole('button', { name: /Encerrar meu turno/ }).click();
  await rafael.page.waitForFunction(
    () => ![...document.querySelectorAll('[aria-label="Ordem de iniciativa"] > li')].some(
      (row) => row.getAttribute('aria-current') === 'step' && row.querySelector('p')?.textContent === 'Kaelen',
    ),
    null,
    { timeout: 10000 },
  );
  ok('Rafael encerra o próprio turno e a vez passa para todos');

  // 22) O mestre encerra o combate e o resumo chega à mesa inteira.
  await master.page.getByRole('button', { name: 'Encerrar combate' }).click();
  await master.page.getByRole('group', { name: 'Encerrar o combate?' }).getByRole('button', { name: 'Encerrar e registrar resumo' }).click();
  for (const { page } of [master, rafael, ana]) {
    await page.getByText(/Combate encerrado: Emboscada na estrada/).first().waitFor({ timeout: 15000 });
  }
  ok('o mestre encerra o combate e o resumo chega ao feed de todos');

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
