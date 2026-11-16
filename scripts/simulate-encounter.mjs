// Simulação visível de uma sessão: um mestre e quatro jogadores, cada um na
// própria janela do navegador, jogando pela interface como a mesa joga hoje.
//
// Antes da luta: os jogadores chegam pela Visão geral e veem o grupo; Rafael
// troca o personagem ativo em Meus personagens (aposenta Thorin e traz Bram),
// e a troca chega ao grupo dos outros sem recarregar; o mestre cria a cena com
// o mapa no Preparo e a abre para a mesa; cada jogador vai para a Mesa, vê o
// mapa (Júlia o põe em tela cheia) e Ana testa Furtividade pela ficha. O
// mestre prepara e inicia o encontro no Preparo e conduz pela Mesa: a barra
// do turno e as ações ficam no painel lateral, o turno de cada um ao lado do
// mapa.
//
// No mapa, antes do round 1 (mover é livre): o mestre acerta o grid, põe o
// encontro e uma carroça pelo "Pôr tokens" e arma a emboscada ao vivo nas
// telas dos jogadores (o xamã escondido nem aparece nem manda movimento).
// Cada jogador arrasta o próprio token; Ana tenta arrastar um goblin e só move
// o mapa; Rafael tenta pegar Bram enquanto o mestre o segura e a trava recusa;
// Pedro move Ysolde pelas setas. A carroça é escondida, revelada e, no fim,
// removida. Dois goblins empatam na iniciativa e o mestre desempata.
//
// No combate, o turno conta: cada movimento do combatente da vez espera
// "Confirmar movimento" e gasta 1,5 m por casa; fora da vez o jogador não
// move, e o servidor recusa passar do restante. Bram usa Disparada, ganha o
// Surto de Ação do mestre e faz os dois ataques do Ataque Extra; ataca fora
// da vez com a reação, que o mestre devolve. Ysolde cura com a ação bônus,
// Zephyr se concentra com a ação e ataca sem alvo (o dano sai pelo feed). O
// bugbear ganha Ataques Múltiplos, que o bestiário guarda; Agarrado zera o
// deslocamento e Exaustão o reduz. Além disso: criatura escondida e revelada,
// ataque secreto, rolagem secreta, vantagem, salvaguarda com metade do dano,
// dano ajustado e descartado, PV temporários, condição com duração,
// concentração, testes contra a morte, reforço e "Voltar turno". No fim, o
// mestre fecha o mapa e Meus personagens mostra os PV com que Bram saiu.
// Cada cena aparece como OK ou FALHA.
//
//   npm run build && npm run db:migrate
//   npm run dev                       # em outro terminal (porta 3000)
//   npm run simulate:encounter
//
// SIM_ROUNDS (padrão 6), SIM_PACE (multiplica as pausas, padrão 1) e
// SIM_SCREEN (padrão 1920x1080) ajustam o ritmo e o tamanho das janelas.

import { chromium } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';

const base = process.env.APP_URL || 'http://localhost:3000';
const dbPath = process.env.DB_FILE || 'quest-fast.db';
const rounds = Number(process.env.SIM_ROUNDS || 6);
const pace = Number(process.env.SIM_PACE || 1);
const [screenWidth, screenHeight] = (process.env.SIM_SCREEN || '1920x1080').split('x').map(Number);
const channel = process.env.PLAYWRIGHT_CHANNEL || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);

if (!existsSync(dbPath)) {
  console.error(`Banco não encontrado em ${dbPath}. Rode antes: npm run db:migrate`);
  process.exit(2);
}

const db = new Database(dbPath);

function ensureUser(discordId, name) {
  db.prepare('INSERT OR IGNORE INTO users (id, discord_id, name) VALUES (?, ?, ?)').run(randomUUID(), discordId, name);
  return db.prepare('SELECT id FROM users WHERE discord_id = ?').get(discordId).id;
}

function createSession(userId) {
  const id = randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(id, userId, expiresAt);
  return id;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms * pace));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const say = (line) => console.log(line);

const checks = new Map();
function check(label, ok, detail = '') {
  if (checks.get(label)?.ok) return;
  checks.set(label, { ok, detail });
  say(`    [${ok ? 'OK' : 'FALHA'}] ${label}${detail ? ` (${detail})` : ''}`);
}

async function call(session, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { cookie: `qf_session=${session}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${payload?.error ?? ''}`);
  return payload;
}

/** The same request, answered whatever the status: for the refusals a scene expects. */
async function attempt(session, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { cookie: `qf_session=${session}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, error: payload?.error ?? '' };
}

const sheet = (overrides) => ({
  level: 3,
  speed: 9,
  skills: [],
  saves: [],
  features: [],
  description: '',
  avatarAssetId: null,
  ...overrides,
});

const masterProfile = { discordId: 'sim-master', name: 'Lia Martins' };
const players = [
  {
    discordId: 'sim-rafael', name: 'Rafael Costa',
    // The sheet of a past adventure: first in the campaign, so it starts active
    // and Rafael swaps it for Bram in Meus personagens before the fight.
    retired: sheet({
      name: 'Thorin Barba-de-Ferro', race: 'Anão', class: 'Guerreiro', level: 2, hp: 20, ac: 16,
      abilityScores: { strength: 15, dexterity: 10, constitution: 15, intelligence: 9, wisdom: 11, charisma: 10 },
      attacks: [{ kind: 'attack', name: 'Martelo de guerra', bonus: 4, damage: '1d8+2', damageType: 'Concussão' }],
    }),
    // Fifth level: a fighter's Extra Attack, two attacks per Attack action.
    character: sheet({
      name: 'Bram Linha Longa', race: 'Anão', class: 'Guerreiro', level: 5, hp: 44, ac: 18,
      abilityScores: { strength: 17, dexterity: 12, constitution: 16, intelligence: 10, wisdom: 12, charisma: 9 },
      skills: ['athletics'], saves: ['strength', 'constitution'],
      attacks: [{ kind: 'attack', name: 'Machado de batalha', bonus: 6, damage: '1d8+3', damageType: 'Cortante' }],
    }),
  },
  {
    discordId: 'sim-ana', name: 'Ana Beatriz',
    character: sheet({
      name: 'Elara Sombravil', race: 'Meio-elfa', class: 'Ladina', hp: 24, ac: 15,
      abilityScores: { strength: 10, dexterity: 18, constitution: 14, intelligence: 12, wisdom: 8, charisma: 13 },
      skills: ['stealth', 'acrobatics'], saves: ['dexterity', 'intelligence'],
      attacks: [{ kind: 'attack', name: 'Adaga', bonus: 6, damage: '1d4+4+2d6', damageType: 'Perfurante', notes: 'Com ataque furtivo' }],
    }),
  },
  {
    discordId: 'sim-pedro', name: 'Pedro Alves',
    character: sheet({
      name: 'Irmã Ysolde', race: 'Humana', class: 'Clériga', hp: 27, ac: 16,
      abilityScores: { strength: 14, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 17, charisma: 12 },
      skills: ['medicine', 'insight'], saves: ['wisdom', 'charisma'],
      attacks: [{ kind: 'attack', name: 'Maça', bonus: 4, damage: '1d6+2', damageType: 'Concussão' }],
    }),
  },
  {
    discordId: 'sim-julia', name: 'Júlia Ramos',
    character: sheet({
      name: 'Zephyr Cinzaluz', race: 'Tiefling', class: 'Mago', hp: 18, ac: 12,
      abilityScores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 17, wisdom: 12, charisma: 10 },
      skills: ['arcana', 'history'], saves: ['intelligence', 'wisdom'],
      attacks: [{ kind: 'attack', name: 'Raio de fogo', bonus: 5, damage: '1d10', damageType: 'Fogo' }],
    }),
  },
];

const creatures = [
  {
    name: 'Goblin', size: 'small', creatureType: 'Humanoide', challengeRating: '1/4', ac: 15, hpAverage: 7, hpFormula: '2d6',
    speed: '9 m', initiativeBonus: 2,
    abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
    attacks: [{ kind: 'attack', name: 'Cimitarra', bonus: 4, damage: '1d6+2', damageType: 'Cortante' }],
    copies: 4,
  },
  {
    name: 'Bugbear', size: 'medium', creatureType: 'Humanoide', challengeRating: '3', ac: 16, hpAverage: 45, hpFormula: '7d8+14',
    speed: '9 m', initiativeBonus: 2,
    abilityScores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 11, charisma: 9 },
    attacks: [{ kind: 'attack', name: 'Maça-estrela', bonus: 4, damage: '2d8+2', damageType: 'Perfurante' }],
    copies: 1,
  },
  {
    name: 'Xamã goblin', size: 'small', creatureType: 'Humanoide', challengeRating: '1/2', ac: 13, hpAverage: 10, hpFormula: '3d6',
    speed: '9 m', initiativeBonus: 2,
    abilityScores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 12, wisdom: 14, charisma: 10 },
    attacks: [{ kind: 'save', name: 'Explosão de chamas', dc: 12, saveAbility: 'dexterity', damage: '2d6', damageType: 'Fogo' }],
    copies: 1,
    hidden: true,
  },
];

const ABILITY_PT = { dexterity: 'Destreza' };
const modifier = (score) => Math.floor((score - 10) / 2);
const SQUARE_METERS = 1.5;
const meters = (value) => `${String(value).replace('.', ',')} m`;

// ---------- Preparação pela API: a mesa já existe quando as janelas abrem.

const master = { ...masterProfile, label: 'Mestre', userId: ensureUser(masterProfile.discordId, masterProfile.name) };
master.session = createSession(master.userId);
for (const player of players) {
  player.label = player.name.split(' ')[0];
  player.userId = ensureUser(player.discordId, player.name);
  player.session = createSession(player.userId);
}

const stamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const campaign = await call(master.session, 'POST', '/api/campaigns', {
  name: `Simulação ${stamp}: Trilha de Triboar`,
  description: 'Mesa montada pelo script de simulação de encontro.',
});
const campaignId = campaign.id;

for (const player of players) {
  await call(player.session, 'POST', '/api/campaigns/join', { code: campaign.inviteCode });
  if (player.retired) await call(player.session, 'POST', `/api/campaigns/${campaignId}/characters`, player.retired);
  const { character } = await call(player.session, 'POST', `/api/campaigns/${campaignId}/characters`, player.character);
  player.characterId = character.id;
  player.characterName = character.name;
  player.attack = player.character.attacks[0];
  player.heals = player.character.class === 'Clériga' ? 3 : 0;
}
for (const creature of creatures) {
  const { copies: _copies, hidden: _hidden, ...input } = creature;
  const { statblock } = await call(master.session, 'POST', `/api/campaigns/${campaignId}/statblocks`, input);
  creature.id = statblock.id;
}

const playerByName = (name) => players.find((p) => p.characterName === name);
const bram = playerByName('Bram Linha Longa');
const elara = playerByName('Elara Sombravil');
const ysolde = playerByName('Irmã Ysolde');
const zephyr = playerByName('Zephyr Cinzaluz');

say(`Campanha "${campaign.name}" pronta: ${players.map((p) => `${p.characterName} (${p.label})`).join(', ')}.`);

/** A battle map drawn on the spot: forest, a dirt road and a 50 px grid. */
async function battleMap() {
  const width = 1600;
  const height = 1200;
  const cell = 50;
  const lines = [];
  for (let x = 0; x <= width; x += cell) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`);
  for (let y = 0; y <= height; y += cell) lines.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#3f5b3b"/>
    <path d="M0 640 C 380 560, 860 780, 1600 600 L1600 740 C 860 900, 380 700, 0 780 Z" fill="#8c7a54"/>
    <circle cx="1220" cy="280" r="170" fill="#2e4a2b"/><circle cx="300" cy="230" r="130" fill="#2e4a2b"/>
    <circle cx="520" cy="1000" r="150" fill="#2e4a2b"/><rect x="980" y="880" width="200" height="150" fill="#6b5b4a"/>
    <g stroke="#000" stroke-opacity=".28" stroke-width="2">${lines.join('')}</g></svg>`;
  const file = join(tmpdir(), `quest-fast-mapa-${Date.now()}.png`);
  await sharp(Buffer.from(svg)).png().toFile(file);
  return file;
}
const mapFile = await battleMap();
const SCENE_NAME = 'Trilha de Triboar';

// ---------- As janelas: o mestre à esquerda, os jogadores num 2x2 à direita.

const half = Math.floor(screenWidth / 2);
const quarterW = Math.floor(half / 2);
const quarterH = Math.floor(screenHeight / 2);
const layout = [
  { who: master, x: 0, y: 0, w: half, h: screenHeight, scale: 0.8 },
  ...players.map((player, i) => ({
    who: player, x: half + (i % 2) * quarterW, y: Math.floor(i / 2) * quarterH, w: quarterW, h: quarterH, scale: 0.6,
  })),
];

const browsers = [];
const campaignUrl = `${base}/campaigns/${campaignId}`;

/** The visible one of a locator: the sidebar and the phone bar repeat the links. */
async function visible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) if (await locator.nth(i).isVisible()) return locator.nth(i);
  return locator.first();
}

/** Moves through the campaign by its menu, the way a person does (no reload). */
async function navigate(page, name) {
  await (await visible(page.getByRole('link', { name }))).click();
}

async function openWindow({ who, x, y, w, h, scale }) {
  const browser = await chromium.launch({
    channel,
    headless: false,
    slowMo: 120 * pace,
    args: [`--window-position=${x},${y}`, `--window-size=${w},${h}`, `--force-device-scale-factor=${scale}`],
  });
  browsers.push(browser);
  const context = await browser.newContext({ viewport: null });
  await context.addCookies([{ name: 'qf_session', value: who.session, url: base }]);
  const caption = who === master ? `Mestre · ${who.name}` : `${who.name} · ${who.characterName}`;
  await context.addInitScript((text) => {
    document.title = text;
    window.addEventListener('DOMContentLoaded', () => {
      const badge = document.createElement('div');
      badge.textContent = text;
      badge.setAttribute('aria-hidden', 'true');
      badge.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;padding:6px 12px;border-radius:999px;'
        + 'background:#111;color:#fff;font:600 14px system-ui;opacity:.85;pointer-events:none';
      document.body.appendChild(badge);
    });
  }, caption);
  const page = await context.newPage();
  // Who received the live position of which token, to tell what reached each screen.
  who.moving = [];
  page.on('websocket', (socket) => socket.on('framereceived', ({ payload }) => {
    try {
      const message = JSON.parse(String(payload));
      if (message.type === 'token.moving') who.moving.push(message.tokenId);
    } catch {
      // Not a JSON message.
    }
  }));
  page.on('pageerror', (error) => {
    say(`  ! ${caption}: ${error.message}`);
    check('nenhum erro de página', false, `${caption}: ${error.message}`);
  });
  // The master starts in Prep; the players arrive at the overview.
  if (who === master) {
    await page.goto(`${campaignUrl}/prep`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Preparo' }).waitFor({ timeout: 20000 });
  } else {
    await page.goto(campaignUrl, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'O grupo' }).waitFor({ timeout: 20000 });
  }
  who.page = page;
}

// ---------- Leitura do estado: o servidor é a fonte de verdade.

let encounterId;
const encounterPath = () => `/api/campaigns/${campaignId}/encounters/${encounterId}`;
const readEncounter = async (session = master.session) => (await call(session, 'GET', encounterPath())).encounter;
const lastEvent = async (session = master.session) => (await call(session, 'GET', `/api/campaigns/${campaignId}/feed?limit=1`)).events.at(-1);
const combatantNamed = (encounter, name) => encounter.combatants.find((c) => c.name === name);
const turnOf = async (name) => combatantNamed(await readEncounter(), name).turn;
const isDown = (c) => c.source === 'character' && c.hpCurrent === 0;
const standingCharacters = (encounter) => encounter.combatants.filter((c) => c.source === 'character' && c.hpCurrent > 0);
const standingFoes = (encounter) => encounter.combatants.filter((c) => c.source !== 'character' && !c.defeated);
const hpText = (c) => `${c.hpCurrent}/${c.hpMax} PV${c.hpTemp ? ` + ${c.hpTemp} temp.` : ''}`;

// ---------- Interação com a tela.

async function scrollTo(locator) {
  await locator.first().scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The table's side panel: the turn bar on top, then the tabs Ações, Dados and Feed. */
const sidePanel = (page) => page.getByRole('complementary', { name: 'Painel da mesa' });

async function openTab(page, label) {
  const tab = sidePanel(page).getByRole('tab', { name: new RegExp(`^${label}`) });
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await sleep(250);
}

/** The free dice, in the Dados tab; the panel goes back to Ações afterwards. */
async function rollFrom(page, expression, { secret = false } = {}) {
  await openTab(page, 'Dados');
  const panel = sidePanel(page).locator('[data-slot="dice-panel"]');
  await scrollTo(panel);
  await panel.getByLabel('Expressão de dados').fill(expression);
  const secretBox = panel.getByRole('checkbox', { name: /Rolar em segredo/ });
  if ((await secretBox.count()) > 0 && (await secretBox.isChecked()) !== secret) await secretBox.setChecked(secret);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/rolls') && r.request().method() === 'POST'),
    panel.getByRole('button', { name: 'Rolar', exact: true }).click(),
  ]);
  const { event } = await response.json();
  if (secret) await secretBox.setChecked(false);
  await openTab(page, 'Ações');
  return event;
}

/** The player's Ações tab: their own combatant, as the fight draws it. */
async function ownPanel(player) {
  await openTab(player.page, 'Ações');
  return sidePanel(player.page);
}

/** The master's Ações tab, opened on one combatant. */
async function masterOn(name) {
  const page = master.page;
  await openTab(page, 'Ações');
  const combatant = combatantNamed(await readEncounter(), name);
  const chosen = sidePanel(page).locator('section[aria-label="Combatente escolhido"]');
  await chosen.getByRole('combobox', { name: 'Combatente', exact: true }).selectOption(combatant.id);
  await chosen.getByRole('heading', { name, exact: true, level: 3 }).waitFor({ timeout: 10000 });
  await scrollTo(chosen);
  return chosen;
}

const actingPanel = (page, name) => (page === master.page ? masterOn(name) : ownPanel(players.find((p) => p.page === page)));

// Each mutation waits for the server's answer, so the next read sees it.
async function clickAndWait(page, locator, pathPart) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/encounters/${encounterId}`) && r.url().includes(pathPart) && r.request().method() !== 'GET'),
    locator.click(),
  ]);
  await sleep(500);
  return response;
}

async function attack(page, attacker, weapon, target, { secret, mode } = {}) {
  const panel = await actingPanel(page, attacker);
  const select = panel.getByLabel(`Alvo de ${attacker}`);
  const value = target === null
    ? ''
    : await select.evaluate((element, name) => [...element.options].find((option) => option.text.startsWith(`${name} — `))?.value, target);
  if (value === undefined) throw new Error(`${target} não está entre os alvos de ${attacker}`);
  await select.selectOption(value);
  if (mode) await panel.locator(`fieldset[aria-label="Tipo de rolagem dos ataques de ${attacker}"] label`).filter({ hasText: new RegExp(`^\\s*${mode}\\s*$`) }).click();
  const secretBox = panel.getByRole('checkbox', { name: /Atacar em segredo/ });
  if (secret !== undefined && (await secretBox.count()) > 0 && (await secretBox.isChecked()) !== secret) await secretBox.setChecked(secret);
  await sleep(400);
  const button = panel.getByRole('button', { name: new RegExp(`^(Atacar com|Rolar dano de) ${escapeRegExp(weapon)}$`) });
  const response = await clickAndWait(page, button, '/attack');
  if (!response.ok()) {
    const { error } = await response.json().catch(() => ({}));
    say(`  ${attacker} tenta atacar ${target ?? 'sem alvo'}: recusado (${error ?? response.status()}).`);
    return { refused: response.status() };
  }
  const event = await lastEvent();
  const { payload } = event;
  let result;
  if (payload.save) result = `CD ${payload.save.dc} de ${ABILITY_PT[payload.save.ability] ?? payload.save.ability}, ${payload.damage.total} de dano (metade se passar)`;
  else if (!payload.target) result = `${payload.total} no ataque, o dano fica para depois`;
  else if (payload.target.hit) result = `${payload.critical ? 'CRÍTICO! ' : ''}acertou (${payload.total} contra CA ${payload.target.ac}), ${payload.damage.total} de dano`;
  else result = `errou (${payload.total} contra CA ${payload.target.ac})`;
  const tags = [event.secret && 'em segredo', payload.mode === 'advantage' && 'com vantagem'].filter(Boolean);
  say(`  ${attacker} ataca ${target ?? 'sem alvo'} com ${weapon}${tags.length ? ` (${tags.join(', ')})` : ''}: ${result}.`);
  await sleep(900);
  return event;
}

const pendingItem = (target) =>
  sidePanel(master.page).getByRole('list', { name: `Pendências de ${target}` }).locator('li[data-kind="pendingDamage"]').first();

/** The master resolves the damage waiting on `target`: as rolled, adjusted, halved or dropped. */
async function resolveDamage(target, how = { kind: 'apply' }) {
  await openTab(master.page, 'Ações');
  const item = pendingItem(target);
  await item.waitFor({ timeout: 10000 });
  await scrollTo(item);
  const before = combatantNamed(await readEncounter(), target);
  if (how.kind === 'adjust') {
    await item.getByLabel('Quantidade').fill(String(how.amount));
    await clickAndWait(master.page, item.getByRole('button', { name: `Aplicar o dano em ${target}`, exact: true }), '/apply');
  } else if (how.kind === 'half') {
    await clickAndWait(master.page, item.getByRole('button', { name: `Metade do dano em ${target}`, exact: true }), '/apply');
  } else if (how.kind === 'discard') {
    await clickAndWait(master.page, item.getByRole('button', { name: `Descartar o dano em ${target}`, exact: true }), '/reminders/');
  } else {
    await clickAndWait(master.page, item.getByRole('button', { name: `Aplicar o dano em ${target}`, exact: true }), '/apply');
  }
  const after = combatantNamed(await readEncounter(), target);
  const verb = { apply: 'aplica o dano', adjust: `ajusta o dano para ${how.amount}`, half: 'aplica metade do dano', discard: 'descarta o dano' }[how.kind];
  const fallen = after.hpCurrent === 0 && before.hpCurrent > 0 ? (after.source === 'character' ? ', caído!' : ', derrotado!') : '';
  say(`    O mestre ${verb}: ${target} fica com ${hpText(after)}${fallen}.`);
  await sleep(700);
  return { before, after };
}

/** Resolves the hit of an attack event, when there is one to resolve. */
async function resolveHit(event, target) {
  if (event.refused || !event.payload.target?.hit || !(event.payload.damage?.total > 0)) return null;
  const result = await resolveDamage(target);
  if (result.after.defeated) check('criatura em 0 PV fica derrotada', true);
  return result;
}

const lostHp = ({ before, after }) => before.hpCurrent + (before.hpTemp ?? 0) - after.hpCurrent - (after.hpTemp ?? 0);

/** Damage, healing or temporary hit points through a combatant's adjuster. */
async function adjustHp(page, name, operation, amount) {
  const panel = await actingPanel(page, name);
  const adjuster = panel.getByRole('group', { name: `Pontos de vida de ${name}` });
  await adjuster.getByLabel('Quantidade').fill(String(amount));
  const label = operation === 'Temporários' ? `Temporários para ${name}` : `${operation} em ${name}`;
  await clickAndWait(page, adjuster.getByRole('button', { name: label }), '/hp');
  return combatantNamed(await readEncounter(), name);
}

// ---------- O turno: o painel ao lado do mapa.

/**
 * The turn panel of `name` beside the map. A player sees their own; the
 * master sees the selected token's combatant, else the one whose turn it is.
 */
async function turnPanel(who, name) {
  const page = who.page;
  const pattern = new RegExp(`^(Turno de ${escapeRegExp(name)}|${escapeRegExp(name)}, fora do turno)$`);
  const heading = page.getByRole('heading', { level: 3, name: pattern });
  if (who === master && !(await heading.isVisible().catch(() => false))) await selectToken(master, name, true);
  await heading.waitFor({ timeout: 10000 });
  const section = heading.locator('xpath=..');
  await scrollTo(section);
  return section;
}

async function selectToken(who, name, on) {
  const row = tokenPanel(who.page).getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}`) }).first();
  if ((await row.count()) === 0) return;
  if (((await row.getAttribute('aria-pressed')) === 'true') !== on) await row.click();
  await sleep(300);
}

/** Spends the action, the bonus action or the reaction from the turn panel. */
async function spendSlot(who, name, slot) {
  const section = await turnPanel(who, name);
  return clickAndWait(who.page, section.getByRole('button', { name: `Usar ${slot} de ${name}`, exact: true }), '/economy');
}

// ---------- Cenas roteiradas.

const story = {
  hiddenChecked: false,
  revealed: false,
  secretChecked: false,
  reinforced: 0,
  rewound: false,
  adjusted: false,
  discarded: false,
  trapSprung: false,
  strikeOnDowned: false,
  frightened: null,
  outOfTurn: false,
  overLimit: false,
  cancelled: false,
  freeMove: false,
  bramSurge: false,
  reaction: false,
  multiattack: false,
  grappled: false,
  exhausted: false,
  untargeted: false,
  secretRoll: false,
};

async function checkHiddenForPlayers() {
  const view = await readEncounter(elara.session);
  const sees = view.combatants.some((c) => c.name === 'Xamã goblin');
  check('a criatura escondida não chega aos jogadores', !sees);
  story.hiddenChecked = true;
}

async function reveal(name) {
  say(`  O mestre revela ${name} para a mesa.`);
  const panel = await masterOn(name);
  await clickAndWait(master.page, panel.getByRole('button', { name: `Revelar para a mesa ${name}` }), '/combatants/');
  const view = await readEncounter(elara.session);
  check('revelar a criatura escondida a mostra para os jogadores', view.combatants.some((c) => c.name === name));
  const token = await tokenPanel(elara.page).getByText(name, { exact: true }).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  check('revelar a criatura no combate mostra o token dela no mapa dos jogadores', token && Boolean(tokenNamed(await readScene(elara.session), name)));
  story.revealed = true;
}

/** Goblins out of the bushes, mid-fight: each rolls initiative and comes onto the map. */
async function reinforce(count) {
  say(count === 1 ? '  Reforço: mais um goblin sai do mato.' : `  Reforço: mais ${count} goblins saem do mato.`);
  const form = master.page.getByRole('form', { name: 'Adicionar reforço' });
  await scrollTo(form);
  const before = new Set((await readEncounter()).combatants.map((c) => c.id));
  await form.locator('fieldset[aria-label="Origem do combatente"] label').filter({ hasText: 'Bestiário' }).click();
  await form.getByRole('combobox', { name: 'Criatura' }).selectOption(creatures[0].id);
  await form.getByLabel('Quantidade').fill(String(count));
  await clickAndWait(master.page, form.getByRole('button', { name: 'Adicionar reforço' }), '/combatants');
  const added = (await readEncounter()).combatants.filter((c) => !before.has(c.id));
  for (const [index, newcomer] of added.entries()) {
    const roll = master.page.getByRole('button', { name: `Rolar iniciativa de ${newcomer.name}` });
    await scrollTo(roll);
    await clickAndWait(master.page, roll, '/initiative');
    const placed = combatantNamed(await readEncounter(), newcomer.name);
    say(`    ${newcomer.name} entra na fila com iniciativa ${placed.initiative}.`);
    check('o reforço entra no meio do combate e ganha lugar na fila', placed.hasInitiative);
    await reinforcementToken(newcomer.name, index);
  }
}

async function reinforcementToken(name, index = 0) {
  const page = master.page;
  say(`    O mestre põe ${name} no mapa pelo seletor, um a um.`);
  await openPicker('Encontro');
  await Promise.all([placedToken(page), page.getByRole('button', { name: `Pôr no mapa ${name}`, exact: true }).click()]);
  await closePicker();
  const scene = await readScene();
  check('o reforço entra no mapa pelo seletor', Boolean(tokenNamed(scene, name)));
  // Not its turn: the master places it freely, without a confirmation.
  if (tokenNamed(scene, name)) await moveToken(master, name, freeCellNear(scene, cellCentre(scene, 26, 11 + 3 * index)));
  await selectToken(master, name, false);
}

async function trap(encounter) {
  const standing = standingCharacters(encounter);
  const victim = standing.find((c) => c.concentrating) ?? standing.find((c) => c.name === 'Zephyr Cinzaluz') ?? standing[0];
  if (!victim) return;
  const amount = victim.hpCurrent + (victim.hpTemp ?? 0);
  say(`  Armadilha! Um alçapão de espinhos se abre sob ${victim.name}: ${amount} de dano.`);
  const after = await adjustHp(master.page, victim.name, 'Dano', amount);
  say(`    ${victim.name} fica com ${hpText(after)}, caído!`);
  check('dano direto do mestre derruba o personagem', after.hpCurrent === 0);
  if (victim.concentrating) check('quem cai a 0 PV perde a concentração', !after.concentrating, after.concentrating ? 'segue concentrando' : '');
  story.trapSprung = true;
}

/** A failed concentration save is the table's call: the player ends it on their own card. */
async function concentrationCheck(player) {
  const panel = await ownPanel(player);
  const button = panel.getByRole('button', { name: `Rolar salvaguarda de ${player.characterName}` });
  await button.first().waitFor({ timeout: 10000 }).catch(() => {});
  if ((await button.count()) === 0) {
    check('dano em quem concentra deixa o lembrete da salvaguarda de Constituição', false, 'botão não apareceu');
    return;
  }
  check('dano em quem concentra deixa o lembrete da salvaguarda de Constituição', true);
  const pending = await button.count();
  if (pending > 1) say(`    ${player.characterName} tem ${pending} salvaguardas de concentração pendentes, uma por dano.`);
  let kept = true;
  while (kept && (await button.count()) > 0) {
    await scrollTo(button);
    await clickAndWait(player.page, button.first(), '/concentration-save');
    const { payload } = await lastEvent();
    const dc = payload.concentrationDc ?? 10;
    kept = payload.total >= dc;
    say(`  ${player.characterName} rola a salvaguarda de concentração: ${payload.total} contra CD ${dc}, ${kept ? 'mantém' : 'perde'} a concentração.`);
  }
  if (!kept) {
    const stop = panel.getByRole('button', { name: `Encerrar concentração de ${player.characterName}` });
    await scrollTo(stop);
    await clickAndWait(player.page, stop, '/concentration');
    player.concentrationLost = true;
  }
  const me = combatantNamed(await readEncounter(), player.characterName);
  check('a concentração segue a decisão da salvaguarda', me.concentrating === kept);
  story.concentrationChecked = true;
}

async function applyCondition(target, value, label, { roundsLeft, level } = {}) {
  const panel = await masterOn(target);
  const form = panel.getByRole('form', { name: `Aplicar condição em ${target}` });
  await form.getByLabel('Condição').selectOption(value);
  if (level) await form.getByLabel('Nível').selectOption(String(level));
  await form.getByLabel('Rodadas').fill(roundsLeft ? String(roundsLeft) : '');
  await clickAndWait(master.page, form.getByRole('button', { name: new RegExp(`(Aplicar|Atualizar) ${label} em`) }), `/conditions/${value}`);
  const after = combatantNamed(await readEncounter(), target);
  const applied = after.conditions.some((c) => c.condition === value);
  say(`    O mestre aplica ${label}${level ? ` ${level}` : ''}${roundsLeft ? ` (${roundsLeft} rodada)` : ''} em ${target}.`);
  return { applied, after };
}

/** Damage on someone already down is a death save failure; two on a critical. */
async function recordDownedFailure(target, critical) {
  const panel = await masterOn(target);
  const button = panel.getByRole('button', { name: `${critical ? 'Duas falhas' : 'Uma falha'} para ${target}` });
  await button.waitFor({ timeout: 10000 }).catch(() => {});
  check('dano em quem está caído deixa o lembrete de falha no teste contra a morte', (await button.count()) > 0);
  if ((await button.count()) === 0) return;
  const before = combatantNamed(await readEncounter(), target).deathSaves;
  await scrollTo(button);
  await clickAndWait(master.page, button, '/death-save');
  const after = combatantNamed(await readEncounter(), target).deathSaves;
  say(`    O mestre marca ${critical ? 'duas falhas' : 'uma falha'}: ${after.successes} sucesso(s), ${after.failures} falha(s).`);
  check('a falha por dano caído conta no teste contra a morte', after.failures > before.failures);
}

async function deathSave(player) {
  const before = combatantNamed(await readEncounter(), player.characterName).deathSaves ?? { successes: 0, failures: 0 };
  const panel = await ownPanel(player);
  const button = panel.getByRole('button', { name: `Teste contra a morte de ${player.characterName}` });
  if ((await button.count()) === 0) {
    say(`  ${player.characterName} está caído e não rola teste (estável ou morto).`);
    return;
  }
  // The first save rolls with advantage (a blessing), the next with disadvantage (poison).
  player.deathSaveRolls = (player.deathSaveRolls ?? 0) + 1;
  const mode = { 1: 'Vantagem', 2: 'Desvantagem' }[player.deathSaveRolls];
  // The choice stays while the tracker is mounted, so a later save picks "Normal" on purpose.
  const modeControl = panel.locator(`fieldset[aria-label="Tipo de rolagem do teste contra a morte de ${player.characterName}"] label`);
  const kept = await modeControl.filter({ has: player.page.locator('input:checked') }).innerText().catch(() => 'Normal');
  if (player.deathSaveRolls > 1) {
    if (kept.trim() !== 'Normal') say(`    O seletor do teste ainda marca ${kept.trim()} do round anterior.`);
    check('o modo do teste contra a morte volta a Normal no round seguinte', kept.trim() === 'Normal', kept.trim() === 'Normal' ? '' : `seguia em ${kept.trim()}`);
  }
  await modeControl.filter({ hasText: new RegExp(`^\\s*${mode ?? 'Normal'}\\s*$`) }).click();
  await scrollTo(button);
  await clickAndWait(player.page, button, '/death-save');
  const { payload } = await lastEvent();
  const me = combatantNamed(await readEncounter(), player.characterName);
  const saves = me.deathSaves ?? { successes: 0, failures: 0 };
  const modeName = { advantage: 'vantagem', disadvantage: 'desvantagem' }[payload.mode];
  const dice = payload.rolls ? ` (${modeName}: ${payload.rolls.join(' e ')}, fica ${payload.d20})` : ` (${payload.d20})`;
  say(`  ${player.characterName} rola o teste contra a morte${dice}: ${saves.successes} sucesso(s), ${saves.failures} falha(s)${me.hpCurrent > 0 ? ' — 20 natural, volta com 1 PV!' : ''}.`);
  if (mode === 'Vantagem') {
    check('o teste contra a morte com vantagem rola dois d20 e fica com o maior',
      payload.mode === 'advantage' && payload.rolls?.length === 2 && payload.d20 === Math.max(...payload.rolls), payload.rolls?.join(' e '));
  }
  if (mode === 'Desvantagem') {
    check('o teste contra a morte com desvantagem rola dois d20 e fica com o menor',
      payload.mode === 'disadvantage' && payload.rolls?.length === 2 && payload.d20 === Math.min(...payload.rolls), payload.rolls?.join(' e '));
  }
  const moved = saves.successes + saves.failures > before.successes + before.failures || me.hpCurrent > 0;
  check('o jogador caído rola o teste contra a morte na própria vez', moved);
  const again = panel.getByRole('button', { name: `Teste contra a morte de ${player.characterName}` });
  const offered = me.hpCurrent === 0 && (await again.count()) > 0 && (await again.isEnabled());
  check('a tela não oferece um segundo teste contra a morte no mesmo round', !offered);
  if (offered) {
    const [response] = await Promise.all([
      player.page.waitForResponse((r) => r.url().endsWith('/death-save') && r.request().method() === 'POST'),
      again.click(),
    ]);
    check('o servidor recusa um segundo teste contra a morte no mesmo round', response.status() === 409, `HTTP ${response.status()}`);
    await sleep(900);
  }
}

// ---------- Abertura: o grupo, o personagem ativo e o mapa.

const partyNames = async (page) => {
  const list = page.getByRole('list', { name: 'O grupo' });
  await list.waitFor({ timeout: 10000 }).catch(() => {});
  return list.locator('li').allInnerTexts();
};

/**
 * The character of this campaign in the account gallery: the showcase when the
 * window is wide enough for the list, its card when it is narrow. Earlier runs
 * leave sheets of the same name in other campaigns, so the campaign decides.
 */
async function galleryEntry(page, name) {
  await page.locator('[data-slot="character-gallery"]').waitFor({ timeout: 15000 });
  const radio = page.getByRole('radio', { name: new RegExp(`^${escapeRegExp(name)},.*${escapeRegExp(campaign.name)}$`) });
  if (await radio.isVisible().catch(() => false)) {
    await radio.click();
    const showcase = page.locator('[data-slot="character-showcase"]');
    await showcase.getByRole('heading', { name, exact: true }).waitFor({ timeout: 10000 });
    return showcase;
  }
  const card = page.locator('[data-slot="hero-card"]').filter({ hasText: campaign.name })
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await card.scrollIntoViewIfNeeded();
  return card;
}

async function swapActiveCharacter() {
  const before = (await partyNames(elara.page)).join(' | ');
  check('a Visão geral mostra o personagem ativo de cada jogador, sem a reserva',
    before.includes('Thorin Barba-de-Ferro') && !before.includes('Bram Linha Longa'));

  say('  Rafael abre Meus personagens pelo menu da campanha.');
  const page = bram.page;
  await navigate(page, 'Meus personagens');
  await page.getByRole('heading', { name: 'Meus personagens' }).waitFor({ timeout: 15000 });
  const showcase = await galleryEntry(page, 'Bram Linha Longa');
  bram.galleryEntry = showcase;
  await sleep(600);

  await showcase.getByRole('button', { name: 'Abrir ficha' }).click();
  const sheetDialog = page.getByRole('dialog');
  await sheetDialog.getByText(/Atributos/).first().waitFor({ timeout: 10000 });
  await sleep(600);
  const plays = (await sheetDialog.getByRole('button', { name: /^Teste de / }).count()) + (await sheetDialog.getByRole('button', { name: 'Dano' }).count());
  check('fora da Mesa a ficha não rola nem muda os PV', plays === 0, plays ? `${plays} controle(s) de jogo` : '');
  await page.keyboard.press('Escape');
  await sheetDialog.waitFor({ state: 'detached', timeout: 10000 });

  await showcase.getByRole('button', { name: 'Ativar nesta campanha' }).click();
  await showcase.getByText('Ativo na mesa').waitFor({ timeout: 10000 });
  say('  Rafael aposenta Thorin e traz Bram Linha Longa para a mesa.');
  // Ana's overview is already open: the swap reaches it through the socket.
  const arrived = await elara.page.getByRole('list', { name: 'O grupo' }).getByRole('button', { name: /Bram Linha Longa/ })
    .waitFor({ timeout: 10000 }).then(() => true, () => false);
  const after = (await partyNames(elara.page)).join(' | ');
  check('a troca de personagem ativo chega ao grupo dos outros sem recarregar', arrived && !after.includes('Thorin Barba-de-Ferro'));
}

async function openTheMap() {
  const page = master.page;
  const scenes = page.locator('section[aria-labelledby="scenes-title"]');
  await scrollTo(scenes);
  say(`  O mestre cria a cena "${SCENE_NAME}" com o mapa da trilha.`);
  await scenes.getByRole('button', { name: 'Criar cena' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome da cena').fill(SCENE_NAME);
  await dialog.locator('input[type="file"]').setInputFiles(mapFile);
  await dialog.getByText(/1600 × 1200/).waitFor({ timeout: 10000 });
  await sleep(600);
  await dialog.getByRole('button', { name: 'Criar cena' }).click();
  await dialog.waitFor({ state: 'detached', timeout: 60000 });
  await sleep(600);
  await scenes.getByRole('button', { name: 'Abrir para a mesa' }).first().click();
  await scenes.getByText('Aberta para a mesa').first().waitFor({ timeout: 10000 });
  say('  O mestre abre a cena para a mesa.');
  sceneId = (await call(master.session, 'GET', `/api/campaigns/${campaignId}/scenes`)).scenes.find((s) => s.name === SCENE_NAME).id;
  const seen = await elara.page.locator('section[aria-labelledby="overview-map-title"]').getByText(SCENE_NAME).first()
    .waitFor({ timeout: 10000 }).then(() => true, () => false);
  check('a cena aberta pelo mestre aparece na Visão geral dos jogadores', seen);
}

async function playersToTheTable() {
  say('  Os jogadores vão para a Mesa.');
  await Promise.all(players.map(async (player) => {
    if (player === bram) {
      // From the gallery, the active character leads straight to its table.
      await bram.galleryEntry.getByRole('link', { name: 'Ir para a mesa' }).click();
    } else {
      await navigate(player.page, /^Mesa/);
    }
    await player.page.getByRole('heading', { name: 'Mesa', level: 1 }).waitFor({ timeout: 15000 });
  }));
  const maps = await Promise.all(players.map((player) =>
    player.page.locator('[data-slot="map-canvas"]').first().waitFor({ timeout: 15000 }).then(() => true, () => false)));
  check('o mapa aberto aparece na Mesa de cada jogador', maps.every(Boolean), `${maps.filter(Boolean).length} de ${maps.length}`);
  const roster = await elara.page.locator('[data-slot="characters-list"] [data-slot="character-row"]').allInnerTexts();
  const names = roster.join(' | ');
  check('a Mesa mostra só o personagem ativo de cada jogador',
    roster.length === players.length && names.includes('Bram Linha Longa') && !names.includes('Thorin Barba-de-Ferro'), `${roster.length} na lista`);
}

/** Júlia's window is small: she fills it with the map and comes back. */
async function fullscreenMap() {
  const page = zephyr.page;
  say('  Júlia põe o mapa em tela cheia e volta.');
  await mapFrame(page).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Mapa em tela cheia' }).first().click();
  const region = page.getByRole('region', { name: `${SCENE_NAME}, mapa em tela cheia` });
  const shown = await region.waitFor({ timeout: 8000 }).then(() => true, () => false);
  await sleep(1200);
  await page.getByRole('button', { name: 'Sair da tela cheia' }).first().click();
  const left = await region.waitFor({ state: 'detached', timeout: 8000 }).then(() => true, () => false);
  check('o mapa entra e sai da tela cheia', shown && left);
}

/** Before the ambush, Ana tests Stealth from her sheet in the Ações tab. */
async function sheetRoll() {
  const panel = await ownPanel(elara);
  const test = panel.getByRole('button', { name: /^Teste de Furtividade/ });
  await scrollTo(test);
  const [response] = await Promise.all([
    elara.page.waitForResponse((r) => r.url().endsWith(`/characters/${elara.characterId}/rolls`) && r.request().method() === 'POST'),
    test.click(),
  ]);
  const { event } = await response.json();
  say(`  Elara se esgueira à frente do grupo: Furtividade ${event.payload.total}.`);
  const seen = await lastEvent(ysolde.session);
  check('o jogador rola uma perícia pela ficha na Mesa e a mesa vê', response.ok() && seen?.id === event.id);
  await sleep(600);
}

/** After the fight, the account gallery shows the hit points the fight left. */
async function galleryAfterFight() {
  const page = bram.page;
  const final = combatantNamed(await readEncounter(), 'Bram Linha Longa');
  await navigate(page, 'Meus personagens');
  await page.getByRole('heading', { name: 'Meus personagens' }).waitFor({ timeout: 15000 });
  const entry = await galleryEntry(page, 'Bram Linha Longa');
  // The gallery refetches on arrival; wait for the hit points the fight left.
  await entry.getByText(`${final.hpCurrent} de ${final.hpMax} pontos de vida`).waitFor({ timeout: 10000 }).catch(() => {});
  const text = await entry.innerText();
  say(`  Rafael confere Bram em Meus personagens: ${hpText(final)}.`);
  check('Meus personagens mostra os PV com que o personagem saiu da luta', text.includes(`${final.hpCurrent} de ${final.hpMax} pontos de vida`), hpText(final));
}

// ---------- O mapa: tokens postos, arrastados e escondidos.

let sceneId;
const scenePath = () => `/api/campaigns/${campaignId}/scenes/${sceneId}`;
const readScene = async (session = master.session) => (await call(session, 'GET', scenePath())).scene;
const tokenNamed = (scene, name) => scene.tokens.find((t) => t.name === name);
const cellCentre = (scene, column, row) => ({
  x: scene.grid.offsetX + (column + 0.5) * scene.grid.cellSize,
  y: scene.grid.offsetY + (row + 0.5) * scene.grid.cellSize,
});
/** "Bram: 3 casas · 4,5 m. Restam 9 m neste turno." → "3 casas · 4,5 m", as the confirm bar shows it. */
const costOf = (text) => text.replace(/^[^:]*:\s*/, '').split('.')[0];
const samePoint = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
/** Squares between two points, diagonals included (the 2024 rule). */
const squaresBetween = (scene, a, b) => Math.round(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / scene.grid.cellSize);

const mapFrame = (page) => page.locator('[data-slot="map-canvas"]').first();
const tokenPanel = (page) => page.locator('section').filter({ has: page.getByRole('heading', { name: /^Tokens/, level: 2 }) }).first();

/** A cell no other token takes, as near `point` as there is. */
function freeCellNear(scene, point, ignoreId = null) {
  const cell = scene.grid.cellSize;
  const taken = (p) => scene.tokens.some((t) => t.id !== ignoreId && Math.hypot(t.x - p.x, t.y - p.y) < cell * 0.9);
  for (let ring = 0; ring < 4; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        const p = { x: point.x + dx * cell, y: point.y + dy * cell };
        if (p.x > 0 && p.y > 0 && p.x < scene.mapWidth && p.y < scene.mapHeight && !taken(p)) return p;
      }
    }
  }
  return point;
}

/**
 * Frames the whole map, then turns a map point into a point on the screen,
 * with the same fit the canvas uses (`fitView`).
 */
async function screenOf(page, scene) {
  const frame = mapFrame(page);
  await frame.scrollIntoViewIfNeeded();
  await frame.getByRole('button', { name: 'Enquadrar o mapa' }).click();
  // The framing glides for a few frames, slower in a busy window: wait until
  // the zoom on screen is the framed one and the canvas holds still.
  const canvas = frame.locator('canvas');
  let box;
  let scale;
  let last = '';
  for (let steady = 0, i = 0; steady < 2 && i < 50; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    box = await canvas.boundingBox();
    scale = Math.min(box.width / scene.mapWidth, box.height / scene.mapHeight);
    const shown = await zoomShown(page);
    const key = `${box.x},${box.y},${box.width},${box.height},${shown}`;
    steady = shown === Math.round(scale * 100) && key === last ? steady + 1 : 0;
    last = key;
  }
  const left = box.x + (box.width - scene.mapWidth * scale) / 2;
  const top = box.y + (box.height - scene.mapHeight * scale) / 2;
  const toScreen = (point) => ({ x: left + point.x * scale, y: top + point.y * scale });
  toScreen.zoom = Math.round(scale * 100);
  toScreen.box = box;
  return toScreen;
}

/** The zoom the map shows ("38%"), as a number. */
async function zoomShown(page) {
  const text = await mapFrame(page).locator('p').filter({ hasText: /\d+%/ }).first().textContent().catch(() => '');
  return Number(text.match(/(\d+)%/)?.[1] ?? NaN);
}

/**
 * What was under the pointer when a drag started, to tell a missed token from
 * one that refused the drag when the drop never comes.
 */
async function probePress(page, at) {
  const under = await page.evaluate(({ x, y }) => {
    const element = document.elementFromPoint(x, y);
    if (!element) return 'nada';
    const slot = element.closest('[data-slot]')?.getAttribute('data-slot');
    return `${element.tagName.toLowerCase()}${slot ? ` em [data-slot=${slot}]` : ''}`;
  }, at);
  const box = await mapFrame(page).locator('canvas').boundingBox();
  return { under, box, zoom: await zoomShown(page), image: await visibleCanvas(page, box) };
}

/**
 * The part of the canvas inside the window. A locator screenshot would scroll
 * the page to show the whole canvas, and the press, already aimed, would miss.
 */
async function visibleCanvas(page, box) {
  const size = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const clip = { x, y, width: Math.min(box.x + box.width, size.width) - x, height: Math.min(box.y + box.height, size.height) - y };
  if (clip.width <= 0 || clip.height <= 0) return null;
  return page.screenshot({ clip }).catch(() => null);
}

/** Presses on (from), drags in steps to (to) and, unless holding, lets go. */
async function dragOnMap(page, from, to, { hold = false } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  }
  if (!hold) await page.mouse.up();
}

/**
 * Drags the token named `name` to the map point `to`. Outside a fight (or a
 * token whose turn it is not) the drop is saved at once. In a fight, the move
 * of the combatant whose turn it is waits on the bar: `confirm` says which
 * button settles it ('confirm', 'free' or 'cancel'), and the answer carries
 * the cost the bar showed.
 */
async function moveToken(who, name, to, options = {}) {
  if (options.hold) return dragToken(who, name, to, options);
  const probe = {};
  try {
    return await dragToken(who, name, to, { ...options, patience: 8000, probe });
  } catch {
    // The drop never came: say what the press met, then try once more.
    const after = probe.box ? await visibleCanvas(who.page, probe.box) : null;
    const moved = probe.image && after ? (probe.image.equals(after) ? 'não' : 'sim') : '?';
    say(`    [AVISO] o arrasto de ${name} não pegou na tela de ${who.label}; nova tentativa.`);
    say(`      sob o ponteiro: ${probe.under}; selecionado depois do toque: ${probe.selected ?? 'nenhum'}; /grab enviado: ${probe.grabbed ? 'sim' : 'não'}`);
    say(`      zoom na tela ${probe.zoom}% (esperado ${probe.expectedZoom}%); canvas ${JSON.stringify(probe.box)}; reenquadrado antes do toque: ${probe.reframed ? 'sim' : 'não'}; o mapa mudou: ${moved}`);
    retriedDrags.push(`${name} (${who.label})`);
    await sleep(1000);
    return dragToken(who, name, to, options);
  }
}

const retriedDrags = [];
const reaimedDrags = [];

async function dragToken(who, name, to, { hold = false, confirm = null, patience, probe = null } = {}) {
  const page = who.page;
  const scene = await readScene(who.session);
  const token = tokenNamed(scene, name);
  if (!token) throw new Error(`${name} não está no mapa de ${who.label}`);
  let screen = await screenOf(page, scene);
  // The layout may still shift between framing and pressing: aim again if the canvas moved.
  const now = await mapFrame(page).locator('canvas').boundingBox();
  if (['x', 'y', 'width', 'height'].some((key) => Math.abs(now[key] - screen.box[key]) > 0.5)) {
    if (probe) probe.reframed = true;
    reaimedDrags.push(`${name} (${who.label})`);
    screen = await screenOf(page, scene);
  }
  const start = screen(token);
  const end = screen(to);
  if (probe) {
    Object.assign(probe, await probePress(page, start), { expectedZoom: screen.zoom });
    const onGrab = (request) => { if (request.url().endsWith(`/tokens/${token.id}/grab`)) probe.grabbed = true; };
    page.on('request', onGrab);
    setTimeout(() => page.off('request', onGrab), 15000);
  }
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  if (probe) probe.selected = await tokenPanel(page).locator('button[aria-pressed="true"]').first().textContent({ timeout: 1000 }).catch(() => null);
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(start.x + ((end.x - start.x) * i) / steps, start.y + ((end.y - start.y) * i) / steps);
  }
  // Held still, the drag would read as over after a second: the hand wobbles a little.
  let held = hold;
  const wobble = (async () => {
    for (let i = 0; held; i += 1) {
      await page.mouse.move(end.x + (i % 2 ? 1 : -1), end.y);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  })();
  const saved = () => page.waitForResponse((r) => r.url().includes(`/tokens/${token.id}`) && r.request().method() === 'PATCH', { timeout: patience ?? 20000 });
  const release = async () => {
    held = false;
    await wobble;
    if (!confirm) {
      await Promise.all([saved(), page.mouse.up()]);
      await sleep(400);
      return { token };
    }
    await page.mouse.up();
    const bar = page.getByRole('group', { name: `Confirmar movimento de ${name}` });
    await bar.waitFor({ timeout: patience ?? 10000 });
    const cost = (await bar.locator('p').first().innerText()).trim();
    await sleep(700);
    const label = { confirm: 'Confirmar movimento', free: 'Mover sem gastar', cancel: 'Cancelar' }[confirm];
    let response = null;
    if (confirm === 'cancel') await bar.getByRole('button', { name: label }).click();
    else [response] = await Promise.all([saved(), bar.getByRole('button', { name: label }).click()]);
    await bar.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    await sleep(500);
    return { token, cost, status: response?.status() };
  };
  if (hold) return { token, release };
  return release();
}

/**
 * The combatant whose turn it is walks toward `target`: to a free cell beside
 * it when the movement left reaches, else straight at it as far as it goes.
 * The bar shows the cost, and the move is confirmed (or, once, made free by
 * the master). Answers with the squares walked.
 */
async function advanceToward(who, mover, target, side, { confirm = 'confirm' } = {}) {
  const scene = await readScene();
  const from = tokenNamed(scene, mover);
  const to = tokenNamed(scene, target);
  if (!from || !to) return null;
  const turn = await turnOf(mover);
  const reach = Math.floor(turn.movementLeft / SQUARE_METERS + 1e-9);
  if (reach === 0 || squaresBetween(scene, from, to) <= 1) return null;
  const cell = scene.grid.cellSize;
  const inside = (p) => p.x > 0 && p.y > 0 && p.x < scene.mapWidth && p.y < scene.mapHeight;
  const taken = (p) => scene.tokens.some((t) => t.id !== from.id && Math.hypot(t.x - p.x, t.y - p.y) < cell * 0.9);
  const around = [[side, 0], [side, -1], [side, 1], [0, -1], [0, 1], [-side, -1], [-side, 1], [-side, 0]];
  let spot = around.map(([dx, dy]) => ({ x: to.x + dx * cell, y: to.y + dy * cell }))
    .find((p) => inside(p) && !taken(p) && squaresBetween(scene, from, p) <= reach);
  if (!spot) {
    const columns = Math.round((to.x - from.x) / cell);
    const rows = Math.round((to.y - from.y) / cell);
    const step = { x: Math.sign(columns) * Math.min(Math.abs(columns), reach), y: Math.sign(rows) * Math.min(Math.abs(rows), reach) };
    spot = [0, -1, 1, -2, 2].map((shift) => ({ x: from.x + step.x * cell, y: from.y + (step.y + shift) * cell }))
      .find((p) => inside(p) && !taken(p) && squaresBetween(scene, from, p) <= reach);
  }
  if (!spot) return null;
  const squares = squaresBetween(scene, from, spot);
  const before = turn.movementUsed;
  const { cost } = await moveToken(who, mover, spot, { confirm });
  const after = await turnOf(mover);
  const beside = squaresBetween(scene, spot, to) <= 1;
  say(`  ${mover} ${beside ? 'avança até' : 'avança na direção de'} ${target}: ${costOf(cost)}.`);
  if (confirm === 'confirm') {
    check('confirmar o movimento gasta 1,5 m por casa, diagonais inclusive',
      Math.abs(after.movementUsed - before - squares * SQUARE_METERS) < 0.01, `${meters(after.movementUsed - before)} por ${squares} casa(s)`);
  }
  if (confirm === 'free') {
    check('"Mover sem gastar" move o combatente da vez sem descontar o deslocamento', after.movementUsed === before);
  }
  return { squares, beside };
}

async function alignGrid() {
  const page = master.page;
  say('  O mestre acerta o grid ao desenho do mapa: 32 casas de 50 px.');
  await page.getByRole('button', { name: 'Ajustar grid' }).click();
  const form = page.getByRole('form', { name: 'Grid do mapa' });
  await form.getByLabel('Casas de largura').fill('32');
  await sleep(600);
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith(`/scenes/${sceneId}`) && r.request().method() === 'PATCH'),
    form.getByRole('button', { name: 'Salvar grid' }).click(),
  ]);
  await page.getByRole('button', { name: 'Ocultar grid' }).click();
  const scene = await readScene();
  check('o mestre acerta o grid e ele vale para a mesa', scene.grid.cellSize === 50, `casa de ${scene.grid.cellSize} px`);
}

async function openPicker(origin) {
  const page = master.page;
  const toggle = page.getByRole('button', { name: 'Pôr tokens' });
  if (await toggle.count()) await toggle.click();
  const picker = page.locator('fieldset[aria-label="Origem do token"]');
  await picker.waitFor({ timeout: 15000 });
  await picker.locator('label').filter({ hasText: new RegExp(`^\\s*${origin}\\s*$`) }).click();
  await sleep(400);
}

async function closePicker() {
  const close = master.page.getByRole('button', { name: 'Fechar tokens' });
  if (await close.count()) await close.click();
}

const placedToken = (page) => page.waitForResponse((r) => /\/scenes\/[^/]+\/tokens(\/encounter)?$/.test(r.url()) && r.request().method() === 'POST');

async function placeTokens() {
  const page = master.page;
  say('  O mestre põe o encontro inteiro no mapa pelo "Pôr tokens".');
  await openPicker('Encontro');
  const all = page.getByRole('button', { name: /^Colocar \d+ combatentes?$/ });
  await all.waitFor({ timeout: 15000 });
  await Promise.all([placedToken(page), all.click()]);
  await sleep(800);

  say('  E uma carroça tombada (token livre, grande) para servir de cobertura.');
  await openPicker('Livre');
  const free = page.locator('form').filter({ has: page.getByLabel('Tamanho') });
  await free.getByLabel('Nome').fill('Carroça tombada');
  await free.getByLabel('Tamanho').selectOption('large');
  await Promise.all([placedToken(page), free.getByRole('button', { name: 'Pôr no mapa' }).click()]);
  await closePicker();
  await sleep(800);

  const scene = await readScene();
  const expected = [...players.map((p) => p.characterName), 'Xamã goblin', 'Carroça tombada'];
  check('"Pôr tokens" põe o encontro inteiro e um token livre no mapa',
    expected.every((name) => tokenNamed(scene, name)) && scene.tokens.length === 11, `${scene.tokens.length} tokens`);
  const forPlayer = await readScene(elara.session);
  const listed = await tokenPanel(elara.page).innerText().catch(() => '');
  check('o token da criatura escondida não chega aos jogadores', !tokenNamed(forPlayer, 'Xamã goblin') && !listed.includes('Xamã goblin'));
}

/** The master lays the ambush: goblins and the bugbear on the road, the shaman among the trees. */
async function layAmbush() {
  let scene = await readScene();
  // The cart lands on the centre of the view, over the encounter's rows: it goes
  // first, off the road, so it covers no one the fight will walk to.
  await moveToken(master, 'Carroça tombada', { x: 14 * scene.grid.cellSize, y: 4 * scene.grid.cellSize });
  scene = await readScene();
  const foes = scene.tokens.filter((t) => t.kind === 'combatant' && t.name !== 'Xamã goblin').sort((a, b) => a.name.localeCompare(b.name));
  // Clear of the rows "Pôr tokens" fills from the centre, so no token lands on another.
  const spots = [[27, 12], [28, 13], [27, 14], [29, 13], [30, 12]];
  for (const player of players) player.moving.length = 0;
  for (const [index, foe] of foes.entries()) {
    const [column, row] = spots[index % spots.length];
    const centre = cellCentre(scene, column, row);
    // Dropped off-centre on purpose: the server snaps it to the cell.
    const drop = { x: centre.x + scene.grid.cellSize * 0.3, y: centre.y - scene.grid.cellSize * 0.2 };
    await moveToken(master, foe.name, drop);
    if (index === 0) {
      const saved = tokenNamed(await readScene(), foe.name);
      check('o token solto encaixa no centro da casa', samePoint(saved, centre), `${saved.x}, ${saved.y}`);
      const reached = players.filter((p) => p.moving.includes(foe.id)).length;
      check('o arrasto do mestre chega ao vivo à tela dos jogadores', reached === players.length, `${reached} de ${players.length}`);
    }
  }
  say('  O mestre arma a emboscada: goblins e o bugbear na trilha.');

  scene = await readScene();
  const shaman = tokenNamed(scene, 'Xamã goblin');
  for (const player of players) player.moving.length = 0;
  await moveToken(master, 'Xamã goblin', cellCentre(scene, 24, 5));
  say('  O xamã, escondido, vai para trás das árvores.');
  const leaked = players.filter((p) => p.moving.includes(shaman.id)).length;
  check('o arrasto de um token escondido não chega aos jogadores', leaked === 0, leaked ? `${leaked} receberam` : '');
}

/** Each player drags their own token onto the road, at the same time. */
async function partyTakesPositions() {
  say('  Cada jogador arrasta o próprio personagem para a trilha.');
  const scene = await readScene();
  const spots = [[8, 13], [7, 12], [7, 14], [6, 13]];
  // They head west from a row, so each starts a moment after the one to their
  // left: no one presses their own token while another token passes over it.
  const fromWest = [...players].sort((a, b) => tokenNamed(scene, a.characterName).x - tokenNamed(scene, b.characterName).x);
  await Promise.all(players.map(async (player, index) => {
    await new Promise((resolve) => setTimeout(resolve, fromWest.indexOf(player) * 1500));
    await moveToken(player, player.characterName, cellCentre(scene, ...spots[index]));
  }));
  const after = await readScene();
  const moved = players.filter((player, index) => samePoint(tokenNamed(after, player.characterName), cellCentre(after, ...spots[index]))).length;
  check('cada jogador arrasta o próprio token', moved === players.length, `${moved} de ${players.length}`);
}

async function playerCannotMoveFoe() {
  const scene = await readScene(elara.session);
  const goblin = scene.tokens.find((t) => t.kind === 'combatant');
  say(`  Ana tenta arrastar ${goblin.name}: só o mapa se move.`);
  const screen = await screenOf(elara.page, scene);
  const before = elara.page.waitForResponse((r) => r.url().includes(`/tokens/${goblin.id}`) && r.request().method() !== 'GET', { timeout: 3000 }).then(() => true, () => false);
  await dragOnMap(elara.page, screen(goblin), screen({ x: goblin.x - 300, y: goblin.y }));
  const sent = await before;
  const after = tokenNamed(await readScene(), goblin.name);
  check('o jogador não arrasta o token de outro (o gesto move o mapa)', !sent && samePoint(after, goblin));
  const refused = await attempt(elara.session, 'PATCH', `${scenePath()}/tokens/${goblin.id}`, { x: 100, y: 100 });
  check('o servidor recusa o jogador movendo o token de outro', refused.status === 403, `HTTP ${refused.status}`);
  await mapFrame(elara.page).getByRole('button', { name: 'Enquadrar o mapa' }).click();
}

async function lockedToken() {
  const scene = await readScene();
  const target = tokenNamed(scene, bram.characterName);
  say('  O mestre segura Bram no meio do arrasto...');
  const holdAt = { x: target.x + scene.grid.cellSize, y: target.y };
  const { release } = await moveToken(master, bram.characterName, holdAt, { hold: true });
  const shown = await tokenPanel(bram.page).getByText(`${master.name} está movendo`).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  check('a lista mostra quem está movendo o token', shown);

  say('  ...e Rafael tenta pegar o próprio personagem ao mesmo tempo.');
  const playerScene = await readScene(bram.session);
  const screen = await screenOf(bram.page, playerScene);
  const grab = bram.page.waitForResponse((r) => r.url().endsWith(`/tokens/${target.id}/grab`), { timeout: 8000 }).catch(() => null);
  // Rafael presses where his screen draws Bram: in the master's hand, not where it was saved.
  await dragOnMap(bram.page, screen(holdAt), screen({ x: holdAt.x, y: holdAt.y + 2 * scene.grid.cellSize }));
  const answer = await grab;
  const warned = await bram.page.getByText('Este token está em uso').first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  check('a trava recusa quem tenta pegar um token que outra pessoa está movendo', answer?.status() === 409 && warned, answer ? `HTTP ${answer.status()}` : 'sem resposta');
  await release();
  await selectToken(master, bram.characterName, false);
  say('  O mestre solta Bram uma casa à frente.');
}

async function keyboardStep() {
  const page = ysolde.page;
  const scene = await readScene();
  const before = tokenNamed(scene, ysolde.characterName);
  say('  Pedro move Ysolde pela lista de tokens, com as setas.');
  const row = tokenPanel(page).getByRole('button', { name: new RegExp(`^${escapeRegExp(ysolde.characterName)}`) });
  await row.scrollIntoViewIfNeeded();
  if ((await row.getAttribute('aria-pressed')) !== 'true') await row.click();
  await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/tokens/${before.id}`) && r.request().method() === 'PATCH'),
    row.press('ArrowRight'),
  ]);
  const after = tokenNamed(await readScene(), ysolde.characterName);
  check('as setas na lista movem o token uma casa', Math.abs(after.x - before.x - scene.grid.cellSize) < 0.01 && after.y === before.y);
}

async function hideAndRevealCart() {
  const list = tokenPanel(master.page);
  say('  O mestre esconde a carroça para preparar uma surpresa...');
  await Promise.all([patchedOrRemoved(master.page), list.getByRole('button', { name: 'Esconder Carroça tombada' }).click()]);
  const gone = await tokenPanel(elara.page).getByText('Carroça tombada').first().waitFor({ state: 'detached', timeout: 8000 }).then(() => true, () => false);
  check('esconder um token o tira da tela dos jogadores', gone && !tokenNamed(await readScene(elara.session), 'Carroça tombada'));
  say('  ...e muda de ideia: revela de novo.');
  await Promise.all([patchedOrRemoved(master.page), list.getByRole('button', { name: 'Revelar Carroça tombada' }).click()]);
  const back = await tokenPanel(elara.page).getByText('Carroça tombada').first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  check('revelar o token o devolve aos jogadores', back);
}

const patchedOrRemoved = (page) => page.waitForResponse((r) => r.url().includes('/tokens/') && ['PATCH', 'DELETE'].includes(r.request().method()));

async function removeCart() {
  const list = tokenPanel(master.page);
  say('  O mestre tira a carroça do mapa.');
  await list.getByRole('button', { name: 'Remover Carroça tombada do mapa' }).click();
  await Promise.all([patchedOrRemoved(master.page), list.getByRole('button', { name: 'Remover Carroça tombada', exact: true }).click()]);
  const gone = await tokenPanel(elara.page).getByText('Carroça tombada').first().waitFor({ state: 'detached', timeout: 8000 }).then(() => true, () => false);
  check('remover o token o tira de todas as telas', gone && !tokenNamed(await readScene(), 'Carroça tombada'));
}

/** The session is over: the master closes the map and it leaves every screen. */
async function closeTheMap() {
  say('  O mestre fecha o mapa para a mesa.');
  await master.page.getByRole('button', { name: 'Fechar para a mesa' }).click();
  const gone = await Promise.all(players.map((player) =>
    player.page.getByText('Nenhum mapa aberto. Quando o mestre abrir um, ele aparece aqui.').waitFor({ timeout: 10000 }).then(() => true, () => false)));
  check('fechar o mapa o tira da Mesa de todos os jogadores', gone.every(Boolean), `${gone.filter(Boolean).length} de ${gone.length}`);
}

async function battlefield() {
  say('No mapa (antes do round 1, mover é livre).');
  await alignGrid();
  await placeTokens();
  await layAmbush();
  await partyTakesPositions();
  await playerCannotMoveFoe();
  await lockedToken();
  await keyboardStep();
  await hideAndRevealCart();
}

// ---------- Iniciativa: empate e desempate.

/** Two goblins hear the same whistle: the master sets them level and breaks the tie. */
async function tieBreak() {
  const page = master.page;
  say('  Goblin 1 e Goblin 2 ouvem o mesmo apito: o mestre põe os dois em 14 e desempata.');
  for (const name of ['Goblin 1', 'Goblin 2']) {
    const input = page.getByLabel(`Iniciativa de ${name}`, { exact: true }).first();
    await scrollTo(input);
    await input.fill('14');
    await clickAndWait(page, page.getByRole('button', { name: `Definir iniciativa de ${name}` }).first(), '/initiative');
  }
  const order = (encounter) => encounter.combatants.filter((c) => c.name === 'Goblin 1' || c.name === 'Goblin 2').map((c) => c.name);
  const before = order(await readEncounter());
  const first = before[0];
  const button = page.getByRole('button', { name: `Depois no empate: ${first}` }).first();
  const offered = await button.waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!offered) {
    check('o mestre desempata a iniciativa com Antes/Depois', false, 'botão não apareceu');
    return;
  }
  await scrollTo(button);
  await clickAndWait(page, button, '/tie-order');
  const after = order(await readEncounter());
  say(`    ${first} passa a agir depois: ${after.join(', ')}.`);
  check('o mestre desempata a iniciativa com Antes/Depois', after[0] !== first, after.join(' → '));
}

// ---------- Turnos.

async function setTempHp(player, amount) {
  const me = await adjustHp(player.page, player.characterName, 'Temporários', amount);
  say(`  ${player.characterName} bebe uma poção de heroísmo: ${hpText(me)}.`);
  check('o jogador define PV temporários no próprio combatente', me.hpTemp === amount);
}

/** Zephyr casts a concentration spell: it spends the action, from the turn panel. */
async function startConcentration(player) {
  const panel = await ownPanel(player);
  await clickAndWait(player.page, panel.getByRole('button', { name: `Marcar concentração de ${player.characterName}` }), '/concentration');
  await spendSlot(player, player.characterName, 'ação');
  const me = combatantNamed(await readEncounter(), player.characterName);
  say(`  ${player.characterName} conjura Escudo Arcano Duradouro (a ação do turno) e se concentra.`);
  check('o jogador marca concentração no próprio combatente', me.concentrating);
  check('"Usar ação" gasta a ação do turno', me.turn.actionUsed, me.turn.actionUsed ? '' : 'ação segue disponível');
}

/** Spiritual Weapon is a bonus action: the action is still there for the mace. */
async function spiritualWeapon(player) {
  await spendSlot(player, player.characterName, 'ação bônus');
  const turn = await turnOf(player.characterName);
  say(`  ${player.characterName} conjura Arma Espiritual (ação bônus); a ação segue livre.`);
  check('a magia de ação bônus gasta a ação bônus e deixa a ação', turn.bonusActionUsed && !turn.actionUsed);
}

/** Healing Word: a bonus action, healed by the master from the roll. */
async function heal(player, ally) {
  const roll = await rollFrom(player.page, '1d4+3');
  await spendSlot(player, player.characterName, 'ação bônus');
  const turn = await turnOf(player.characterName);
  check('a magia de ação bônus gasta a ação bônus e deixa a ação', turn.bonusActionUsed && !turn.actionUsed);
  say(`  ${player.characterName} conjura Palavra Curativa (ação bônus) em ${ally.name}: ${roll.payload.total} de cura.`);
  await sleep(600);
  await healed(ally, roll.payload.total);
  return turn;
}

async function healed(ally, amount) {
  const after = await adjustHp(master.page, ally.name, 'Cura', amount);
  say(`    ${ally.name} volta a ${hpText(after)}.`);
  if (ally.hpCurrent === 0) check('cura levanta um personagem caído e zera os testes contra a morte', after.hpCurrent > 0 && (after.deathSaves?.successes ?? 0) + (after.deathSaves?.failures ?? 0) === 0);
}

/** With the cleric down, someone else spends their action pouring a potion into the fallen. */
async function potion(player, ally) {
  const roll = await rollFrom(player.page, '2d4+2');
  await spendSlot(player, player.characterName, 'ação');
  say(`  ${player.characterName} usa a ação para dar uma poção de cura a ${ally.name}: ${roll.payload.total}.`);
  await healed(ally, roll.payload.total);
}

/**
 * Off their turn a player's token stays put: the drag only pans the map, and
 * the server refuses the request too.
 */
async function playerOutOfTurn(player) {
  const scene = await readScene(player.session);
  const token = tokenNamed(scene, player.characterName);
  if (!token) return;
  say(`  Fora da vez, ${player.characterName} tenta se reposicionar.`);
  const screen = await screenOf(player.page, scene);
  const sent = player.page.waitForResponse((r) => r.url().includes(`/tokens/${token.id}`) && r.request().method() !== 'GET', { timeout: 3000 }).then(() => true, () => false);
  await dragOnMap(player.page, screen(token), screen({ x: token.x + scene.grid.cellSize, y: token.y }));
  const moved = await sent;
  const after = tokenNamed(await readScene(), player.characterName);
  check('fora da vez, o jogador não arrasta o próprio token', !moved && samePoint(after, token));
  const refused = await attempt(player.session, 'PATCH', `${scenePath()}/tokens/${token.id}`, { x: token.x + scene.grid.cellSize, y: token.y });
  check('o servidor recusa o jogador movendo o próprio token fora da vez', refused.status === 403, `HTTP ${refused.status}`);
  await mapFrame(player.page).getByRole('button', { name: 'Enquadrar o mapa' }).click();
  story.outOfTurn = true;
}

/** What each one sees of the reach: the player only their own characters'. */
async function reachVisibility() {
  const forPlayer = await readScene(elara.session);
  const forMaster = await readScene();
  const own = tokenNamed(forPlayer, elara.characterName);
  const foe = forPlayer.tokens.find((t) => t.kind === 'combatant' && t.combatantId);
  check('o jogador recebe o alcance do próprio personagem e nunca o de uma criatura',
    own?.reach !== null && own?.reach !== undefined && foe?.reach === null && tokenNamed(forMaster, foe.name)?.reach !== null);
}

/** Before moving, the player asks the server for more than is left: refused. */
async function overLimit(player) {
  const scene = await readScene(player.session);
  const token = tokenNamed(scene, player.characterName);
  const turn = await turnOf(player.characterName);
  const squares = Math.floor(turn.movementLeft / SQUARE_METERS) + 3;
  const direction = token.x + squares * scene.grid.cellSize < scene.mapWidth ? 1 : -1;
  const refused = await attempt(player.session, 'PATCH', `${scenePath()}/tokens/${token.id}`, { x: token.x + direction * squares * scene.grid.cellSize, y: token.y });
  check('o servidor recusa um movimento além do deslocamento que resta', refused.status === 422, `HTTP ${refused.status} ${refused.error}`);
  story.overLimit = true;
}

/** The player drags, sees the cost and changes their mind: the token goes back. */
async function cancelledMove(player, target) {
  const scene = await readScene();
  const token = tokenNamed(scene, player.characterName);
  const goal = tokenNamed(scene, target);
  const step = Math.sign(goal.x - token.x) || 1;
  const spot = freeCellNear(scene, { x: token.x + 2 * step * scene.grid.cellSize, y: token.y }, token.id);
  const { cost } = await moveToken(player, player.characterName, spot, { confirm: 'cancel' });
  const after = tokenNamed(await readScene(), player.characterName);
  const turn = await turnOf(player.characterName);
  say(`  ${player.characterName} mede o caminho (${costOf(cost)}) e desiste: Cancelar.`);
  await sleep(800);
  check('cancelar o movimento devolve o token sem gastar o deslocamento', samePoint(after, token) && turn.movementUsed === 0);
  story.cancelled = true;
}

/** Bram's first turn: Dash, then Action Surge for two attacks of Extra Attack. */
async function bramOpens(encounter) {
  const name = bram.characterName;
  const start = await turnOf(name);
  check('o Ataque Extra do guerreiro de nível 5 conta dois ataques por ação', start.attacksPerAction === 2, `${start.attacksPerAction} por ação`);
  const section = await turnPanel(bram, name);
  await clickAndWait(bram.page, section.getByRole('button', { name: `Disparada de ${name}` }), '/economy');
  const dashed = await turnOf(name);
  say(`  ${name} usa Disparada: ${meters(dashed.movementLeft)} para andar neste turno.`);
  check('Disparada gasta a ação e soma o deslocamento de novo', dashed.actionUsed && dashed.movementLeft === dashed.speed * 2, meters(dashed.movementLeft));

  const foes = standingFoes(encounter).filter((c) => !c.hidden);
  const target = foes.find((c) => c.name === 'Bugbear')?.name ?? pick(foes).name;
  await advanceToward(bram, name, target, -1);

  say('  O mestre concede o Surto de Ação a Bram.');
  const forMaster = await turnPanel(master, name);
  await clickAndWait(master.page, forMaster.getByRole('button', { name: `Conceder ação a ${name}` }), '/economy');
  const surged = await turnOf(name);
  check('o mestre concede uma ação extra (Surto de Ação)', surged.extraActions === 1);

  const first = await attack(bram.page, name, bram.attack.name, target);
  const afterFirst = await turnOf(name);
  check('o primeiro ataque gasta a ação e deixa o segundo do Ataque Extra', !first.refused && afterFirst.attacksLeft === 1 && afterFirst.extraActions === 0, `faltam ${afterFirst.attacksLeft}`);
  await resolveHit(first, target);
  const nextTarget = async () => {
    const left = standingFoes(await readEncounter()).filter((c) => !c.hidden);
    return (left.find((c) => c.name === target) ?? pick(left))?.name;
  };
  const secondTarget = await nextTarget();
  if (!secondTarget) return;
  const second = await attack(bram.page, name, bram.attack.name, secondTarget);
  const afterSecond = await turnOf(name);
  check('o segundo ataque do Ataque Extra não gasta outra ação', !second.refused && afterSecond.attacksLeft === 0);
  await resolveHit(second, secondTarget);
  const thirdTarget = await nextTarget();
  if (!thirdTarget) return;
  const third = await attack(bram.page, name, bram.attack.name, thirdTarget);
  check('o servidor recusa um ataque sem ação nem ataque sobrando', third.refused === 422, third.refused ? `HTTP ${third.refused}` : 'atacou de novo');
  await sleep(1500);
  story.bramSurge = true;
}

/**
 * A goblin breaks away from Bram: an opportunity attack off his turn, which
 * spends the reaction. A second one is refused; the master gives it back.
 */
async function opportunityAttack(active) {
  const name = bram.characterName;
  say(`  ${active.name} tenta escapar e Bram aproveita: ataque de oportunidade (reação).`);
  const before = await turnOf(name);
  const event = await attack(bram.page, name, bram.attack.name, active.name);
  const used = await turnOf(name);
  check('atacar fora da vez gasta a reação, não a ação nem os ataques',
    !event.refused && used.reactionUsed && used.actionUsed === before.actionUsed && used.attacksLeft === before.attacksLeft && used.extraActions === before.extraActions);
  await resolveHit(event, active.name);
  const foes = standingFoes(await readEncounter()).filter((c) => !c.hidden);
  const again = foes.find((c) => c.name === active.name) ?? foes[0];
  if (again) {
    const refused = await attack(bram.page, name, bram.attack.name, again.name);
    check('a segunda reação na mesma rodada é recusada', refused.refused === 422, refused.refused ? `HTTP ${refused.refused}` : 'atacou de novo');
  }
  say('  O mestre devolve a reação: o goblin não chegou a sair do alcance.');
  const forMaster = await turnPanel(master, name);
  await clickAndWait(master.page, forMaster.getByRole('button', { name: `Devolver reação de ${name}` }), '/economy');
  check('o mestre devolve a reação gasta', !(await turnOf(name)).reactionUsed);
  await selectToken(master, name, false);
  story.reaction = true;
}

/** Zephyr fires without a target: the damage is rolled afterwards, from the feed. */
async function untargetedAttack(player, target) {
  const event = await attack(player.page, player.characterName, player.attack.name, null);
  if (event.refused) return;
  await openTab(player.page, 'Feed');
  const button = sidePanel(player.page).getByRole('button', { name: `Rolar dano de ${player.attack.name}` }).first();
  const offered = await button.waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!offered) {
    check('sem alvo, o dano é rolado depois pelo feed', false, 'botão não apareceu');
    await openTab(player.page, 'Ações');
    return;
  }
  await scrollTo(button);
  const [response] = await Promise.all([
    player.page.waitForResponse((r) => r.url().endsWith(`/${event.id}/damage`) && r.request().method() === 'POST'),
    button.click(),
  ]);
  const damage = (await response.json()).event?.payload?.damage?.total;
  await openTab(player.page, 'Ações');
  check('sem alvo, o dano é rolado depois pelo feed', response.ok() && damage > 0, `${damage} de dano`);
  story.untargeted = true;
  // Without a target the master compares the roll with the AC at the table.
  const foe = combatantNamed(await readEncounter(), target);
  if (!foe || foe.defeated || event.payload.natural === 1 || event.payload.total < foe.ac || !(damage > 0)) {
    say(`    Júlia rola o dano pelo feed (${damage}), mas o raio passa longe de ${target}.`);
    return;
  }
  say(`    Júlia rola o dano pelo feed: ${damage}. O raio atinge ${target}.`);
  const after = await adjustHp(master.page, target, 'Dano', damage);
  say(`    O mestre aplica à mão: ${target} fica com ${hpText(after)}${after.defeated ? ', derrotado!' : ''}.`);
}

async function playerTurn(player, encounter) {
  const me = combatantNamed(encounter, player.characterName);
  if (isDown(me)) {
    await deathSave(player);
    return;
  }
  // Help reaches a fallen ally after their two death saves and a goblin's blow
  // on the ground, so the table sees all three; sooner when they are one
  // failure from death or the fight is about to end.
  const fallen = encounter.combatants.find((c) => {
    const failures = c.deathSaves?.failures ?? 0;
    const rolls = playerByName(c.name)?.deathSaveRolls ?? 0;
    if (!isDown(c) || failures >= 3) return false;
    return (rolls >= 2 && story.strikeOnDowned) || (rolls >= 1 && failures >= 2) || (rolls >= 1 && encounter.round >= rounds - 1);
  });
  const clericUp = standingCharacters(encounter).some((c) => c.name === ysolde.characterName);
  if (fallen && !clericUp && !player.potionGiven) {
    player.potionGiven = true;
    await potion(player, fallen);
    return;
  }
  if (player === bram && !player.tempDone) {
    player.tempDone = true;
    await setTempHp(player, 8);
  }
  if (player === bram && !story.bramSurge) {
    await bramOpens(encounter);
    return;
  }
  // Zephyr opens firing into the bushes; then he concentrates, and casts again
  // after losing the spell, so the trap still finds him concentrating.
  if (player === zephyr && story.untargeted && !me.concentrating && !story.trapSprung && (!player.concentrated || player.concentrationLost)) {
    player.concentrationLost = false;
    player.concentrated = true;
    await startConcentration(player);
    // Back to the spell after a save, he steps back onto the trap: the fall ends it.
    if (story.concentrationChecked && !story.trapSprung) await trap(await readEncounter());
    return;
  }
  if (player.heals > 0) {
    const hurt = encounter.combatants
      .filter((c) => c.source === 'character' && c.hpCurrent > 0 && c.hpCurrent / c.hpMax <= 0.4)
      .sort((a, b) => a.hpCurrent / a.hpMax - b.hpCurrent / b.hpMax)[0];
    const ally = fallen ?? hurt;
    if (ally) {
      player.heals -= 1;
      await heal(player, ally);
    } else if (!player.spiritualWeapon) {
      player.spiritualWeapon = true;
      await spiritualWeapon(player);
    }
  }
  const foes = standingFoes(encounter).filter((c) => !c.hidden);
  if (foes.length === 0) return;
  const target = pick(foes).name;
  if (!story.overLimit) await overLimit(player);
  if (!story.cancelled && player === elara) await cancelledMove(player, target);
  await advanceToward(player, player.characterName, target, -1);
  if (player === zephyr && !story.untargeted) {
    say('  Zephyr ouve um galho estalar no mato e atira na direção do som, sem alvo.');
    await untargetedAttack(player, target);
    return;
  }
  const event = await attack(player.page, player.characterName, player.attack.name, target, player === elara ? { mode: 'Vantagem' } : {});
  if (player === elara && !event.refused) {
    const d20s = event.payload.dice.filter((die) => die.sides === 20).length;
    check('o ataque com vantagem rola dois d20 e fica com o maior', event.payload.mode === 'advantage' && d20s === 2);
  }
  await resolveHit(event, target);
}

async function savingThrow(player, ability, dc) {
  const score = player.character.abilityScores[ability];
  const bonus = modifier(score) + (player.character.saves.includes(ability) ? 2 : 0);
  const roll = await rollFrom(player.page, `1d20${bonus >= 0 ? '+' : ''}${bonus}`);
  const passed = roll.payload.total >= dc;
  say(`    ${player.characterName} rola a salvaguarda de ${ABILITY_PT[ability]}: ${roll.payload.total} contra CD ${dc}, ${passed ? 'passou' : 'falhou'}.`);
  return passed;
}

/** The master's numbers for the bugbear: Multiattack, kept by the bestiary for next time. */
async function multiattack(active) {
  say('  O mestre lembra dos Ataques Múltiplos do bugbear: 2 ataques por ação.');
  const section = await turnPanel(master, active.name);
  await section.locator('summary').filter({ hasText: 'Ajustar deslocamento e ataques' }).click();
  await section.getByLabel('Ataques por ação').fill('2');
  await clickAndWait(master.page, section.getByRole('button', { name: `Salvar deslocamento e ataques de ${active.name}` }), `/combatants/${active.id}`);
  const turn = await turnOf(active.name);
  check('o mestre ajusta os ataques por ação da criatura no combate', turn.attacksPerAction === 2, `${turn.attacksPerAction} por ação`);
  story.multiattack = true;
}

/** Conditions on the walk: Grappled holds the speed at 0, each Exhaustion level takes 1,5 m. */
async function conditionOnSpeed(active) {
  if (!story.grappled) {
    say(`    Uma raiz se enrosca na perna de ${active.name}.`);
    const { applied } = await applyCondition(active.name, 'grappled', 'Agarrado', { roundsLeft: 1 });
    const turn = await turnOf(active.name);
    check('Agarrado zera o deslocamento', applied && turn.speed === 0 && turn.movementLeft === 0, meters(turn.speed));
    story.grappled = true;
    return;
  }
  say(`    ${active.name} chega ofegante da corrida pelo mato.`);
  const { applied } = await applyCondition(active.name, 'exhaustion', 'Exaustão', { level: 1 });
  const turn = await turnOf(active.name);
  check('cada nível de Exaustão tira 1,5 m do deslocamento', applied && turn.speed === 7.5, meters(turn.speed));
  story.exhausted = true;
}

async function monsterTurn(active, encounter) {
  const creature = creatures.find((c) => active.name.startsWith(c.name));
  const weapon = creature.attacks[0];
  const standing = standingCharacters(encounter);
  // A goblin strikes the fallen once they rolled both death saves (advantage,
  // then disadvantage), and never one failure from death: that blow would kill.
  const downed = encounter.combatants.filter((c) => isDown(c) && (c.deathSaves?.failures ?? 0) <= 1 && (playerByName(c.name)?.deathSaveRolls ?? 0) >= 2);
  if (standing.length === 0 || active.defeated) return;

  if (!story.reaction && story.bramSurge && creature.name === 'Goblin' && standing.some((c) => c.name === bram.characterName)) {
    await opportunityAttack(active);
    if (combatantNamed(await readEncounter(), active.name).defeated) return;
  }
  if (creature.name === 'Bugbear' && !story.multiattack) await multiattack(active);
  if (creature.name === 'Goblin' && story.freeMove && (!story.grappled || !story.exhausted)) await conditionOnSpeed(active);

  let target;
  if (downed.length > 0 && !story.strikeOnDowned && creature.name === 'Goblin') {
    target = downed[0].name;
    say(`  ${active.name} aproveita e golpeia ${target}, caído no chão.`);
  } else if (creature.name === 'Xamã goblin') {
    // Until a save halves the flames once, the shaman aims at the nimble rogue.
    const rogue = story.halved ? undefined : standing.find((c) => c.name === elara.characterName);
    target = (rogue ?? standing.find((c) => c.concentrating) ?? standing.find((c) => c.hpTemp > 0) ?? pick(standing)).name;
  } else if (creature.name === 'Goblin' && !story.concentrationChecked && standing.some((c) => c.concentrating)) {
    // The goblins know a caster when they see one: the concentrating mage draws their blades.
    target = standing.find((c) => c.concentrating).name;
  } else {
    // Zephyr stays behind the cart until he casts, and the bugbear keeps to the
    // front line until a goblin has tested his concentration.
    const spared = (c) => c.name === zephyr.characterName && (!zephyr.concentrated || (creature.name === 'Bugbear' && !story.concentrationChecked));
    const exposed = standing.filter((c) => !spared(c));
    target = pick(exposed.length > 0 ? exposed : standing).name;
  }

  if (creature.name !== 'Xamã goblin') {
    // Once, a goblin slides down the bank: the master moves it without spending.
    const free = !story.freeMove && creature.name === 'Goblin';
    if (free) say(`  ${active.name} escorrega barranco abaixo: o mestre o move sem gastar o deslocamento.`);
    const walked = await advanceToward(master, active.name, target, 1, { confirm: free ? 'free' : 'confirm' });
    if (free && walked) story.freeMove = true;
  }

  const attacks = (await turnOf(active.name)).attacksPerAction;
  for (let i = 0; i < attacks; i += 1) {
    const now = await readEncounter();
    if (!standingCharacters(now).some((c) => c.name === target) && !(downed.some((c) => c.name === target))) break;
    await strike(active, creature, weapon, target, now);
  }
}

async function strike(active, creature, weapon, target, encounter) {
  // The first goblin attack stays secret, as monsters start; the rest the table sees.
  const secret = !story.secretChecked && creature.name === 'Goblin' && !active.hidden ? true : active.hidden ? undefined : false;
  const playerFeedBefore = await lastEvent(elara.session);
  const event = await attack(master.page, active.name, weapon.name, target, { secret });
  if (event.refused) return;

  if (event.secret && !story.secretChecked) {
    const playerFeedAfter = await lastEvent(elara.session);
    check('o ataque secreto do mestre não chega ao feed dos jogadores', playerFeedAfter?.id === playerFeedBefore?.id);
    story.secretChecked = true;
  }

  const { payload } = event;
  if (!(payload.damage?.total > 0) || !payload.target?.hit) return;
  const victim = playerByName(target);
  const wasConcentrating = combatantNamed(encounter, target).concentrating;
  const wasDown = isDown(combatantNamed(encounter, target));

  let how = { kind: 'apply' };
  if (payload.save) {
    const passed = await savingThrow(victim, payload.save.ability, payload.save.dc);
    how = passed ? { kind: 'half' } : { kind: 'apply' };
  } else if (!story.adjusted && !wasDown) {
    how = { kind: 'adjust', amount: Math.max(1, payload.damage.total - 2) };
    say(`    A armadura de ${target} absorve 2 pontos.`);
  } else if (!story.discarded && encounter.round >= 3 && !wasDown && !wasConcentrating) {
    how = { kind: 'discard' };
    say(`    ${target} gasta a inspiração heroica e o mestre desconsidera o golpe.`);
  }

  const result = await resolveDamage(target, how);
  const lost = lostHp(result);
  if (how.kind === 'half') story.halved = true;
  if (how.kind === 'half') check('"Metade" aplica metade do dano da salvaguarda', lost === Math.min(Math.floor(payload.damage.total / 2), result.before.hpCurrent + (result.before.hpTemp ?? 0)), `${lost} de ${payload.damage.total}`);
  if (how.kind === 'adjust') { story.adjusted = true; check('o mestre ajusta o dano antes de aplicar', lost === Math.min(how.amount, result.before.hpCurrent + (result.before.hpTemp ?? 0)), `${lost} aplicado`); }
  if (how.kind === 'discard') { story.discarded = true; check('descartar o dano não mexe nos PV', lost === 0); }
  if ((result.before.hpTemp ?? 0) > 0 && lost > 0) {
    check('PV temporários absorvem o dano primeiro', result.after.hpCurrent === result.before.hpCurrent - Math.max(0, lost - result.before.hpTemp));
  }

  if (wasDown) {
    story.strikeOnDowned = true;
    await recordDownedFailure(target, payload.critical === true);
    return;
  }
  if (wasConcentrating && result.after.hpCurrent > 0 && lost > 0) await concentrationCheck(victim);
  if (wasConcentrating && result.after.hpCurrent === 0) check('quem cai a 0 PV perde a concentração', !result.after.concentrating, result.after.concentrating ? 'segue concentrando' : '');
  if (creature.name === 'Bugbear' && !story.frightened && result.after.hpCurrent > 0) {
    say(`    O urro do bugbear aterroriza ${target}.`);
    const { applied } = await applyCondition(target, 'frightened', 'Amedrontado', { roundsLeft: 1 });
    check('o mestre aplica uma condição com duração', applied);
    story.frightened = { target, value: 'frightened', label: 'Amedrontado' };
  }
}

/** The master rolls in secret behind the screen: the players' feed never gets it. */
async function secretRoll() {
  say('  O mestre rola em segredo a Percepção do xamã.');
  const before = await lastEvent(elara.session);
  const event = await rollFrom(master.page, '1d20+4', { secret: true });
  const after = await lastEvent(elara.session);
  check('a rolagem secreta do mestre não chega aos jogadores', event.secret === true && after?.id === before?.id);
  story.secretRoll = true;
}

async function advance(page, buttonName, encounter) {
  await sidePanel(page).getByRole('button', { name: buttonName }).click();
  const before = `${encounter.round}:${encounter.activeCombatantId}`;
  for (let i = 0; i < 50; i += 1) {
    const now = await readEncounter();
    if (`${now.round}:${now.activeCombatantId}` !== before) return now;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('o turno não avançou');
}

async function rewind(encounter) {
  const current = encounter.activeCombatantId;
  say('  O mestre passa o turno cedo demais...');
  let next = await advance(master.page, 'Próximo turno', encounter);
  say('  ...e volta um turno para corrigir.');
  next = await advance(master.page, 'Voltar turno', next);
  check('"Voltar turno" devolve a vez a quem estava jogando', next.activeCombatantId === current && next.round === encounter.round);
  story.rewound = true;
  return next;
}

/** The frightened condition, set for one round, is gone after its bearer's next turn. */
async function checkConditionExpired(finished) {
  if (!story.frightened || story.frightened.target !== finished || story.frightened.done) return;
  const encounter = await readEncounter();
  const bearer = combatantNamed(encounter, finished);
  if (bearer.conditions.some((c) => c.condition === story.frightened.value)) return;
  check('a condição com duração expira no fim do turno de quem a carrega', true);
  say(`    ${story.frightened.label} de ${finished} terminou.`);
  story.frightened.done = true;
}

/** A new turn gives back the action, the bonus action and the movement. */
function checkFreshTurn(active) {
  const turn = active.turn;
  if (!turn) return;
  check('a vez nova começa com ação, ação bônus e deslocamento cheios',
    !turn.actionUsed && !turn.bonusActionUsed && turn.movementUsed === 0 && turn.dashes === 0 && turn.extraActions === 0);
}

try {
  say('Abrindo as cinco janelas...');
  await Promise.all(layout.map(openWindow));
  await sleep(1500);

  say('Abertura da sessão.');
  await swapActiveCharacter();
  await openTheMap();
  await playersToTheTable();
  await fullscreenMap();
  await sheetRoll();
  await sleep(1200);

  say('O mestre prepara o encontro no Preparo (o xamã fica escondido).');
  let section = master.page.locator('section[aria-labelledby="combat-title"]');
  await scrollTo(section);
  await section.getByLabel('Nome do novo encontro').fill('Emboscada na Trilha de Triboar');
  const [created] = await Promise.all([
    master.page.waitForResponse((r) => r.url().endsWith('/encounters') && r.request().method() === 'POST'),
    section.getByRole('button', { name: 'Preparar encontro' }).click(),
  ]);
  encounterId = (await created.json()).encounter.id;
  await sleep(800);

  const form = master.page.getByRole('form', { name: 'Adicionar combatente' });
  for (const player of players) {
    await form.locator('fieldset[aria-label="Origem do combatente"] label').filter({ hasText: 'Personagem' }).click();
    await form.getByRole('combobox', { name: 'Personagem' }).selectOption(player.characterId);
    await clickAndWait(master.page, form.getByRole('button', { name: 'Adicionar ao encontro' }), '/combatants');
  }
  for (const creature of creatures) {
    await form.locator('fieldset[aria-label="Origem do combatente"] label').filter({ hasText: 'Bestiário' }).click();
    await form.getByRole('combobox', { name: 'Criatura' }).selectOption(creature.id);
    await form.getByLabel('Quantidade').fill(String(creature.copies));
    await form.locator('fieldset[aria-label="Pontos de vida de cada cópia"] label').filter({ hasText: 'Rolados' }).click();
    if (creature.hidden) await form.getByLabel('Entra escondido dos jogadores').check();
    await clickAndWait(master.page, form.getByRole('button', { name: 'Adicionar ao encontro' }), '/combatants');
  }

  say('Combate iniciado no Preparo; o mestre vai para a Mesa e conduz pelo painel lateral.');
  section = master.page.locator('section[aria-labelledby="combat-title"]');
  await scrollTo(section);
  await section.getByRole('button', { name: 'Iniciar combate' }).click();
  await section.getByRole('button', { name: 'Rolar iniciativa das criaturas' }).waitFor({ timeout: 15000 });
  await sleep(800);
  await navigate(master.page, /^Mesa/);
  await master.page.getByRole('heading', { name: 'Mesa', level: 1 }).waitFor({ timeout: 15000 });
  await battlefield();

  say('Iniciativa.');
  await tieBreak();
  await sidePanel(master.page).getByRole('button', { name: 'Rolar iniciativa das criaturas' }).click();
  await sleep(800);
  await Promise.all(players.map(async (player) => {
    const panel = await ownPanel(player);
    await panel.getByRole('button', { name: `Rolar iniciativa de ${player.characterName}` }).click({ timeout: 20000 });
  }));
  await sleep(1200);

  let encounter = await readEncounter();
  say(`Ordem: ${encounter.combatants.map((c) => `${c.name} (${c.initiative})${c.hidden ? ' [escondido]' : ''}`).join(', ')}.`);
  await checkHiddenForPlayers();

  encounter = await advance(master.page, 'Começar round 1', encounter);
  await reachVisibility();
  let lastRound = 0;

  while (encounter.round <= rounds) {
    if (standingFoes(encounter).length === 0 || standingCharacters(encounter).length === 0) break;

    if (encounter.round !== lastRound) {
      lastRound = encounter.round;
      if (encounter.round === 1 && !story.secretRoll) await secretRoll();
      if (encounter.round === 2 && story.reinforced < 1) {
        story.reinforced = 1;
        await reinforce(1);
      }
      if (encounter.round === 3 && story.reinforced < 2) {
        story.reinforced = 2;
        await reinforce(2);
      }
      // The trap waits for Zephyr's concentration (see playerTurn); if the fight
      // never gets there, it springs on round 4 anyway.
      const concentrating = standingCharacters(encounter).some((c) => c.concentrating);
      if (!story.trapSprung && ((concentrating && story.concentrationChecked) || encounter.round >= 4)) await trap(await readEncounter());
      encounter = await readEncounter();
    }

    const active = encounter.combatants.find((c) => c.id === encounter.activeCombatantId);
    say(`Round ${encounter.round} · vez de ${active.name}${active.hidden ? ' (escondido)' : ''}`);
    checkFreshTurn(active);

    if (encounter.round === 2 && active.hidden && !story.revealed) {
      await reveal(active.name);
      encounter = await readEncounter();
    }

    if (active.source === 'character') {
      const player = players.find((p) => p.characterId === active.characterId);
      await playerTurn(player, encounter);
      await sleep(600);
      encounter = await advance(player.page, 'Encerrar meu turno', encounter);
      await checkConditionExpired(active.name);
    } else {
      if (!story.outOfTurn) {
        const bystander = players.find((p) => standingCharacters(encounter).some((c) => c.name === p.characterName));
        if (bystander) await playerOutOfTurn(bystander);
      }
      await monsterTurn(active, encounter);
      await sleep(600);
      // Going back from a combatant that fell on its own turn would skip it: rewind from one still up.
      const now = await readEncounter();
      if (now.round >= 2 && !story.rewound && !combatantNamed(now, active.name)?.defeated) encounter = await rewind(now);
      encounter = await advance(master.page, 'Próximo turno', encounter);
    }
    await sleep(900);
  }

  say('O mestre encerra o combate.');
  await sidePanel(master.page).getByRole('button', { name: 'Encerrar combate' }).click();
  await sidePanel(master.page).getByRole('button', { name: 'Encerrar e registrar resumo' }).click();
  await sleep(1500);
  const final = await readEncounter();
  for (const c of final.combatants) say(`  ${c.name}: ${hpText(c)}`);
  if (final.summary) say(`  Resumo: ${final.summary.rounds} round(s); derrotados: ${final.summary.defeated.join(', ') || 'nenhum'}.`);
  const summaryEvent = await lastEvent(elara.session);
  check('o resumo do combate chega ao feed dos jogadores', summaryEvent?.payload?.kind === 'combat.ended');
  await removeCart();
  await closeTheMap();
  await galleryAfterFight();
} catch (error) {
  console.error(`\nA simulação parou: ${error.message.split('\n')[0]}`);
  // A picture of every window at the moment it stopped, to see what was in the way.
  for (const who of [master, ...players]) {
    if (!who.page) continue;
    const file = join(tmpdir(), `quest-fast-simulacao-${who.label}.png`);
    await who.page.screenshot({ path: file }).then(() => console.error(`  Tela de ${who.label}: ${file}`), () => {});
  }
  process.exitCode = 1;
}

const expected = [
  'a Visão geral mostra o personagem ativo de cada jogador, sem a reserva',
  'fora da Mesa a ficha não rola nem muda os PV',
  'a troca de personagem ativo chega ao grupo dos outros sem recarregar',
  'a cena aberta pelo mestre aparece na Visão geral dos jogadores',
  'o mapa aberto aparece na Mesa de cada jogador',
  'a Mesa mostra só o personagem ativo de cada jogador',
  'o mapa entra e sai da tela cheia',
  'o jogador rola uma perícia pela ficha na Mesa e a mesa vê',
  'o mestre acerta o grid e ele vale para a mesa',
  '"Pôr tokens" põe o encontro inteiro e um token livre no mapa',
  'o token da criatura escondida não chega aos jogadores',
  'o token solto encaixa no centro da casa',
  'o arrasto do mestre chega ao vivo à tela dos jogadores',
  'o arrasto de um token escondido não chega aos jogadores',
  'cada jogador arrasta o próprio token',
  'o jogador não arrasta o token de outro (o gesto move o mapa)',
  'o servidor recusa o jogador movendo o token de outro',
  'a lista mostra quem está movendo o token',
  'a trava recusa quem tenta pegar um token que outra pessoa está movendo',
  'as setas na lista movem o token uma casa',
  'esconder um token o tira da tela dos jogadores',
  'revelar o token o devolve aos jogadores',
  'o mestre desempata a iniciativa com Antes/Depois',
  'a criatura escondida não chega aos jogadores',
  'o jogador recebe o alcance do próprio personagem e nunca o de uma criatura',
  'a vez nova começa com ação, ação bônus e deslocamento cheios',
  'a rolagem secreta do mestre não chega aos jogadores',
  'fora da vez, o jogador não arrasta o próprio token',
  'o servidor recusa o jogador movendo o próprio token fora da vez',
  'o servidor recusa um movimento além do deslocamento que resta',
  'cancelar o movimento devolve o token sem gastar o deslocamento',
  'confirmar o movimento gasta 1,5 m por casa, diagonais inclusive',
  '"Mover sem gastar" move o combatente da vez sem descontar o deslocamento',
  'o Ataque Extra do guerreiro de nível 5 conta dois ataques por ação',
  'Disparada gasta a ação e soma o deslocamento de novo',
  'o mestre concede uma ação extra (Surto de Ação)',
  'o primeiro ataque gasta a ação e deixa o segundo do Ataque Extra',
  'o segundo ataque do Ataque Extra não gasta outra ação',
  'o servidor recusa um ataque sem ação nem ataque sobrando',
  'atacar fora da vez gasta a reação, não a ação nem os ataques',
  'a segunda reação na mesma rodada é recusada',
  'o mestre devolve a reação gasta',
  '"Usar ação" gasta a ação do turno',
  'a magia de ação bônus gasta a ação bônus e deixa a ação',
  'sem alvo, o dano é rolado depois pelo feed',
  'o mestre ajusta os ataques por ação da criatura no combate',
  'Agarrado zera o deslocamento',
  'cada nível de Exaustão tira 1,5 m do deslocamento',
  'revelar a criatura escondida a mostra para os jogadores',
  'revelar a criatura no combate mostra o token dela no mapa dos jogadores',
  'o reforço entra no mapa pelo seletor',
  'o ataque secreto do mestre não chega ao feed dos jogadores',
  'o ataque com vantagem rola dois d20 e fica com o maior',
  'o jogador define PV temporários no próprio combatente',
  'o jogador marca concentração no próprio combatente',
  'o reforço entra no meio do combate e ganha lugar na fila',
  '"Voltar turno" devolve a vez a quem estava jogando',
  'dano direto do mestre derruba o personagem',
  'o jogador caído rola o teste contra a morte na própria vez',
  'o teste contra a morte com vantagem rola dois d20 e fica com o maior',
  'o teste contra a morte com desvantagem rola dois d20 e fica com o menor',
  'a tela não oferece um segundo teste contra a morte no mesmo round',
  'o modo do teste contra a morte volta a Normal no round seguinte',
  'quem cai a 0 PV perde a concentração',
  'o mestre aplica uma condição com duração',
  'a condição com duração expira no fim do turno de quem a carrega',
  '"Metade" aplica metade do dano da salvaguarda',
  'o mestre ajusta o dano antes de aplicar',
  'descartar o dano não mexe nos PV',
  'PV temporários absorvem o dano primeiro',
  'dano em quem concentra deixa o lembrete da salvaguarda de Constituição',
  'a concentração segue a decisão da salvaguarda',
  'dano em quem está caído deixa o lembrete de falha no teste contra a morte',
  'a falha por dano caído conta no teste contra a morte',
  'cura levanta um personagem caído e zera os testes contra a morte',
  'criatura em 0 PV fica derrotada',
  'o resumo do combate chega ao feed dos jogadores',
  'remover o token o tira de todas as telas',
  'fechar o mapa o tira da Mesa de todos os jogadores',
  'Meus personagens mostra os PV com que o personagem saiu da luta',
];
say('\nCenas:');
for (const label of expected) {
  const result = checks.get(label);
  say(`  ${result ? (result.ok ? 'OK   ' : 'FALHA') : 'NÃO OCORREU'} ${label}${result?.detail ? ` (${result.detail})` : ''}`);
}
for (const [label, result] of checks) if (!expected.includes(label)) say(`  ${result.ok ? 'OK   ' : 'FALHA'} ${label}${result.detail ? ` (${result.detail})` : ''}`);

if (reaimedDrags.length > 0) say(`\nArrastos remirados porque o canvas se moveu antes do toque: ${reaimedDrags.join(', ')}.`);
if (retriedDrags.length > 0) say(`\nArrastos que precisaram de nova tentativa: ${retriedDrags.join(', ')}.`);

say('\nSimulação concluída. Feche qualquer janela ou pressione Ctrl+C para sair.');
await Promise.race(browsers.map((browser) => new Promise((resolve) => browser.on('disconnected', resolve))));
await Promise.all(browsers.map((browser) => browser.close().catch(() => {})));
db.close();
