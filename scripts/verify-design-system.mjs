import { chromium, expect, errors as playwrightErrors } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'test-results/design-system');
mkdirSync(output, { recursive: true });
// A fixed port let a second concurrent run silently audit the first run's build.
const port = process.env.STORYBOOK_URL ? null : await new Promise((done, fail) => {
  const probe = createServer().once('error', fail).listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => done(port));
  });
});
const base = process.env.STORYBOOK_URL || `http://127.0.0.1:${port}`;
const filter = process.argv[2] || '';
let server;
let browser;
const results = [];
try {
  if (!process.env.STORYBOOK_URL) {
    server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--outDir', 'storybook-static', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: resolve(root, 'client'), windowsHide: true, stdio: 'pipe',
    });
    server.stderr.on('data', data => process.stderr.write(data));
    const exited = new Promise((_, fail) => server.once('exit', code => fail(new Error(`O servidor do Storybook encerrou antes de responder (código ${code}).`))));
    exited.catch(() => {});
    await Promise.race([
      exited,
      expect.poll(async () => { try { return (await fetch(`${base}/index.json`)).ok; } catch { return false; } }, { timeout: 30000 }).toBe(true),
    ]);
  }
  const channel = process.env.PLAYWRIGHT_CHANNEL || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);
  browser = await chromium.launch({ channel, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const index = await fetch(`${base}/index.json`).then(r => r.json());
  const stories = Object.values(index.entries).filter(entry => entry.type === 'story' && entry.id.includes(filter));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Console errors do not fail a story; they only explain a story that hangs.
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  // A failing play leaves the render phase at "finished", and storyFinished
  // reports "error" even for stories without a play, so the only reliable
  // signal is the channel event. The trap subscribes before any story runs.
  await page.addInitScript(() => {
    window.__storyFailures = [];
    let channel;
    Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
      configurable: true,
      get: () => channel,
      set(value) {
        channel = value;
        for (const event of ['playFunctionThrewException', 'storyErrored', 'storyThrewException']) {
          value.on(event, error => window.__storyFailures.push({
            event,
            // Testing Library appends the whole DOM to its messages.
            message: String(error?.message ?? error?.description ?? error?.title ?? error).replace(/\u001b\[\d+m/g, '').split('\n\nIgnored nodes:')[0].slice(0, 600),
          }));
        }
      },
    });
  });
  class StoryFailure extends Error {
    constructor(failures) {
      super(`${failures.map(failure => `${failure.event}: ${failure.message}`).join('; ')}`);
      this.failures = failures;
    }
  }
  // The story never reached a final render phase. Only this failure earns a
  // retry: it has shown up on random stories in long runs and passes alone.
  class SettleTimeout extends Error {
    constructor(summary, diagnosis) {
      super(`tempo esgotado esperando a story assentar (${summary})`);
      this.summary = summary;
      this.diagnosis = diagnosis;
    }
  }
  // A hung page can also hang evaluate and screenshot, so each probe is capped.
  const capped = (promise, fallback) => Promise.race([promise.catch(error => `${fallback}: ${error.message.split('\n')[0]}`), new Promise(done => setTimeout(() => done(fallback), 5000))]);
  async function diagnose(id, attempt) {
    const state = await capped(page.evaluate(() => ({
      phases: window.__STORYBOOK_PREVIEW__?.storyRenders?.map(render => render.phase) ?? null,
      failures: window.__storyFailures ?? null,
    })), 'página não respondeu');
    const screenshot = resolve(output, `${id}-timeout-${attempt}.png`);
    const shot = await capped(page.screenshot({ path: screenshot, fullPage: true, timeout: 5000 }).then(() => screenshot), 'captura falhou');
    const diagnosis = { story: id, attempt, url: page.url(), ...(typeof state === 'string' ? { state } : state), pageErrors: [...errors], consoleErrors: [...consoleErrors], screenshot: shot };
    writeFileSync(resolve(output, `${id}-timeout-${attempt}.json`), JSON.stringify(diagnosis, null, 2) + '\n');
    const phases = typeof state === 'string' ? state : `fases [${state.phases?.join(', ') ?? 'sem preview'}]`;
    const latest = list => (list.length ? ` (última: ${list.at(-1).replace(/\s+/g, ' ').slice(0, 160)})` : '');
    const summary = `${phases}; erros de página: ${errors.length}${latest(errors)}; erros de console: ${consoleErrors.length}${latest(consoleErrors)}; detalhes em test-results/design-system/${id}-timeout-${attempt}.{json,png}`;
    return new SettleTimeout(summary, diagnosis);
  }
  async function visit(id, theme = 'both', attempt = 1) {
    errors.length = 0;
    consoleErrors.length = 0;
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
    const settled = () => window.__storyFailures?.length > 0
      || window.__STORYBOOK_PREVIEW__?.storyRenders?.some(render => ['completed', 'finished', 'errored'].includes(render.phase));
    try {
      await page.waitForFunction(settled, undefined, { timeout: Number(process.env.DESIGN_SETTLE_TIMEOUT_MS) || 30000 });
    } catch (error) {
      if (error instanceof playwrightErrors.TimeoutError) throw await diagnose(id, attempt);
      throw error;
    }
    const failures = await page.evaluate(() => window.__storyFailures);
    if (failures.length > 0) throw new StoryFailure(failures);
    await page.locator('.theme-frame__panel').first().waitFor({ timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const phases = await page.evaluate(() => window.__STORYBOOK_PREVIEW__.storyRenders.map(render => render.phase));
    expect(phases).not.toContain('errored');
    expect(errors).toEqual([]);
  }
  const CONTROLS = { 'expects-play-failure': ['playFunctionThrewException'], 'expects-render-failure': ['storyErrored', 'storyThrewException'] };
  // Negative controls: stories that fail on purpose. If the verifier lets one
  // through, it has gone blind again and the whole run fails.
  async function control(story, expected) {
    try {
      await visit(story.id);
    } catch (error) {
      if (error.failures?.some(failure => expected.includes(failure.event))) return;
      throw error;
    }
    throw new Error(`${story.id}: o controle negativo não reprovou; o verificador deixou de enxergar ${expected.join(' ou ')}.`);
  }
  function escapes() {
    const found = [];
    const boxes = [...document.querySelectorAll('#storybook-root *')].filter(el => {
      const style = getComputedStyle(el);
      return parseFloat(style.borderLeftWidth) > 0 && parseFloat(style.borderRightWidth) > 0 && style.overflowX === 'visible'
        && style.display !== 'contents' && el.checkVisibility();
    });
    for (const box of boxes) {
      const outer = box.getBoundingClientRect();
      for (const child of box.querySelectorAll('*')) {
        const style = getComputedStyle(child);
        // Closed <details> content still reports client rects in Chrome, so
        // only what is actually rendered counts as escaping.
        if (['absolute', 'fixed', 'sticky'].includes(style.position) || !child.checkVisibility()) continue;
        if (child.closest('[data-slot="dialog-content"], [data-slot="dropdown-menu-content"], [data-slot="tooltip-content"], [data-sonner-toaster]') !== box.closest('[data-slot="dialog-content"], [data-slot="dropdown-menu-content"], [data-slot="tooltip-content"], [data-sonner-toaster]')) continue;
        const inner = child.getBoundingClientRect();
        if (inner.right > outer.right + 1 || inner.left < outer.left - 1) {
          found.push(`${child.tagName.toLowerCase()}.${String(child.className).slice(0, 40)} sai de ${box.tagName.toLowerCase()}.${String(box.className).slice(0, 40)}`);
          break;
        }
      }
    }
    return found.slice(0, 5);
  }
  async function audit() {
    await page.addScriptTag({ path: resolve(root, 'node_modules/axe-core/axe.min.js') });
    return page.evaluate(async () => {
      const result = await window.axe.run(document.querySelector('#storybook-root'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      return { violations: result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })), incomplete: result.incomplete.map(v => v.id) };
    });
  }
  for (const story of stories) {
    try {
      const expected = Object.entries(CONTROLS).find(([tag]) => story.tags?.includes(tag))?.[1];
      if (expected) {
        await control(story, expected);
        results.push({ story: story.id, passed: true, control: true });
        console.log(`PASS ${story.id} (controle negativo reprovou como esperado)`);
        continue;
      }
      // Negative controls above never retry: they must fail exactly as before.
      let flaky;
      try {
        await visit(story.id);
      } catch (error) {
        if (!(error instanceof SettleTimeout)) throw error;
        flaky = error.summary;
        console.warn(`RETRY ${story.id}: ${error.message}`);
        await visit(story.id, 'both', 2);
      }
      const a11y = await audit();
      expect(a11y.violations, story.id).toEqual([]);
      expect(a11y.incomplete, `${story.id}: verificações inconclusivas`).toEqual([]);
      const duplicateIds = await page.locator('#storybook-root [id]').evaluateAll(elements => {
        const ids = elements.map(element => element.id);
        return ids.filter((id, i) => ids.indexOf(id) !== i);
      });
      expect(duplicateIds).toEqual([]);
      await expect(page.locator('.contrast-specimen').filter({ hasText: /Revisar|Calculando/ })).toHaveCount(0);
      for (const width of [320, 390, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        // The page can stay inside the viewport while a child pokes out of its
        // own card, so every bordered box must hold its in-flow content. Polled
        // because the resize relayout can still be settling on the first read.
        await expect.poll(() => page.evaluate(escapes), { message: `${story.id} @${width}px` }).toEqual([]);
        const closed = await page.evaluate(() => {
          const details = [...document.querySelectorAll('#storybook-root details:not([open])')];
          details.forEach(el => { el.open = true; el.dataset.auditOpened = ''; });
          return details.length;
        });
        if (closed) {
          await expect.poll(() => page.evaluate(escapes), { message: `${story.id} @${width}px com details aberto` }).toEqual([]);
          await page.evaluate(() => document.querySelectorAll('#storybook-root details[data-audit-opened]').forEach(el => {
            el.open = false;
            delete el.dataset.auditOpened;
          }));
        }
      }
      results.push({ story: story.id, passed: true, themes: ['dark', 'light'], widths: [320, 390, 768, 1280], ...(flaky && { flaky }) });
      console.log(flaky ? `PASS ${story.id} (passou na segunda tentativa: ${flaky})` : `PASS ${story.id}`);
    } catch (error) {
      results.push({ story: story.id, passed: false, error: error.message });
      console.error(`FAIL ${story.id}: ${error.message}`);
      await page.screenshot({ path: resolve(output, `${story.id}-failure.png`), fullPage: true });
    }
  }
  if (!filter || filter === '--specs') {
    // Extra interactive scenarios exercise the real components, dialog open.
    for (const theme of ['dark', 'light']) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await visit('componentes-dialog--padrao', theme);
      const trigger = page.getByRole('button', { name: 'Criar campanha' });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Uma nova aventura' });
      await expect(dialog.getByRole('textbox')).toBeFocused();
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true); }
      expect((await audit()).violations).toEqual([]);
      const dialogColor = await dialog.evaluate(el => getComputedStyle(el).backgroundColor);
      const token = await page.locator('.theme-frame').evaluate(el => getComputedStyle(el).getPropertyValue('--color-surface-overlay').trim());
      expect(dialogColor).toBe(theme === 'dark' ? 'rgb(34, 37, 45)' : 'rgb(255, 255, 255)');
      expect(token).toBeTruthy();
      await expect(dialog).toHaveCSS('animation-name', 'none');
      await page.screenshot({ path: resolve(output, `dialog-${theme}.png`), fullPage: true });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveCSS('outline-style', 'solid');
      await expect(trigger).toHaveCSS('outline-width', '2px');

      await visit('componentes-copyfield--padrao', theme);
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.getByRole('button', { name: 'Copiar' }).click();
      await expect(page.getByRole('status')).toContainText('Código copiado.');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('MESA42');

      await visit('campanha--mestre', theme);
      await page.screenshot({ path: resolve(output, `campaign-${theme}-desktop.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByRole('navigation', { name: 'Navegação da campanha' }).getByRole('link', { name: 'Membros', exact: true })).toBeVisible();
      await page.screenshot({ path: resolve(output, `campaign-${theme}-mobile.png`), fullPage: true });
      await page.getByRole('button', { name: /Campanha: Ecos de Phandalin/ }).click();
      await page.getByRole('menuitemradio', { name: /A névoa de Baróvia/ }).click();
      await expect(page.getByRole('heading', { name: 'A névoa de Baróvia' })).toBeVisible();
      await expect(page.getByText('1 na mesa')).toBeVisible();
      const controls = await page.locator('button, select, summary').evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => ({ label: el.textContent, height: el.getBoundingClientRect().height })));
      expect(controls.filter(control => control.height < 44)).toEqual([]);
    }
    // Side by side, each theme frame is narrower than the sidebar breakpoint,
    // so the desktop sidebar is only exercised with one theme at a time.
    for (const theme of ['dark', 'light']) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await visit('componentes-appshell--combate-em-andamento', theme);
      expect((await audit()).violations).toEqual([]);
      await page.getByRole('button', { name: 'Recolher menu' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Expandir menu' })).toBeFocused();
      await expect(page.getByRole('link', { name: 'Mesa, Rodada 3' })).toBeVisible();
      expect((await audit()).violations).toEqual([]);
      await page.screenshot({ path: resolve(output, `shell-${theme}-collapsed.png`) });
      await page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Recolher menu' })).toBeFocused();
      await page.screenshot({ path: resolve(output, `shell-${theme}-expanded.png`) });
    }
    // System preference and reduced motion, including runtime changes.
    for (const theme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await visit('foundations--default', 'system');
      await expect(page.locator('.theme-frame')).toHaveAttribute('data-preview-theme', theme);
      expect(await page.locator('[data-slot="skeleton"]').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none'))).toBe(true);
      const themeCheck = await page.evaluate(theme => {
        const frame = document.querySelector('.theme-frame');
        frame.removeAttribute('data-preview-theme');
        document.documentElement.dataset.theme = theme;
        const surface = document.querySelector('[data-slot="surface"]');
        surface.dataset.theme = theme === 'dark' ? 'light' : 'dark';
        const read = () => getComputedStyle(surface).getPropertyValue('--color-text-primary').trim();
        const manual = read();
        delete document.documentElement.dataset.theme;
        return { manual, system: read() };
      }, theme);
      expect(themeCheck.manual).toBe(theme === 'dark' ? '#edeff3' : '#16181d');
      expect(themeCheck.system).toBe(themeCheck.manual);
    }
    for (const id of ['componentes-diceresult--natural-20', 'componentes-diceresult--natural-1', 'componentes-diceresult--vantagem', 'componentes-diceresult--desvantagem']) {
      await visit(id);
      await expect(page.locator('[data-slot="dice-total"]').first()).toHaveAttribute('data-reduced-motion', 'true');
      await expect(page.locator('[data-slot="dice-total"]').first()).toHaveCSS('transform', 'none');
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await visit('componentes-diceresult--natural-20');
    await expect(page.locator('[data-slot="dice-total"]').first()).toHaveAttribute('data-reduced-motion', 'false');
    await expect(page.locator('[data-slot="dice-total"]').first()).toHaveCSS('transform', 'none');
    await page.screenshot({ path: resolve(output, 'dice-result.png'), fullPage: true });
    results.push({ story: 'interactions-and-specs', passed: true });
  }
} catch (error) {
  results.push({ story: 'verification', passed: false, error: error.stack });
  console.error(error);
} finally {
  await browser?.close();
  server?.kill();
  writeFileSync(resolve(output, 'results.json'), JSON.stringify(results, null, 2) + '\n');
  if (!results.length || results.some(result => !result.passed)) process.exitCode = 1;
  console.log(`${results.filter(result => result.passed).length}/${results.length} verificações aprovadas.`);
  const flaky = results.filter(result => result.flaky).map(result => result.story);
  if (flaky.length) console.log(`${flaky.length} instáveis (passaram na segunda tentativa): ${flaky.join(', ')}.`);
}
