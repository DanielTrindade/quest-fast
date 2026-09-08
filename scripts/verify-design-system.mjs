import { chromium, expect } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'test-results/design-system');
mkdirSync(output, { recursive: true });
const base = process.env.STORYBOOK_URL || 'http://localhost:6007';
const filter = process.argv[2] || '';
let server;
let browser;
const results = [];
try {
  if (!process.env.STORYBOOK_URL) {
    server = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), 'preview', '--outDir', 'storybook-static', '--port', '6007', '--strictPort'], {
      cwd: resolve(root, 'client'), windowsHide: true, stdio: 'pipe',
    });
    server.stderr.on('data', data => process.stderr.write(data));
    await expect.poll(async () => { try { return (await fetch(`${base}/index.json`)).ok; } catch { return false; } }, { timeout: 30000 }).toBe(true);
  }
  const channel = process.env.PLAYWRIGHT_CHANNEL || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'chrome' : undefined);
  browser = await chromium.launch({ channel, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const index = await fetch(`${base}/index.json`).then(r => r.json());
  const stories = Object.values(index.entries).filter(entry => entry.type === 'story' && entry.id.includes(filter));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  async function visit(id, theme = 'both') {
    errors.length = 0;
    await page.goto(`${base}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`);
    await page.locator('.theme-frame__panel').first().waitFor({ timeout: 30000 });
    await page.waitForFunction(() => window.__STORYBOOK_PREVIEW__?.storyRenders?.some(render => ['completed', 'finished', 'errored'].includes(render.phase)), undefined, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const phases = await page.evaluate(() => window.__STORYBOOK_PREVIEW__.storyRenders.map(render => render.phase));
    expect(phases).not.toContain('errored');
    expect(errors).toEqual([]);
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
      await visit(story.id);
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
      }
      results.push({ story: story.id, passed: true, themes: ['dark', 'light'], widths: [320, 390, 768, 1280] });
      console.log(`PASS ${story.id}`);
    } catch (error) {
      results.push({ story: story.id, passed: false, error: error.message });
      console.error(`FAIL ${story.id}: ${error.message}`);
      await page.screenshot({ path: resolve(output, `${story.id}-failure.png`), fullPage: true });
    }
  }
  if (!filter || filter === '--specs') {
    // Cenários interativos adicionais exercitam os componentes reais, com o diálogo aberto.
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
      await page.getByText('Navegação da campanha', { exact: true }).click();
      await expect(page.getByRole('link', { name: 'Membros', exact: true })).toBeVisible();
      await page.screenshot({ path: resolve(output, `campaign-${theme}-mobile.png`), fullPage: true });
      await page.getByRole('combobox', { name: 'Campanha' }).selectOption('barovia');
      await expect(page.getByRole('heading', { name: 'A névoa de Baróvia' })).toBeVisible();
      await expect(page.getByText('1 na mesa')).toBeVisible();
      const controls = await page.locator('button, select, summary').evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => ({ label: el.textContent, height: el.getBoundingClientRect().height })));
      expect(controls.filter(control => control.height < 44)).toEqual([]);
    }
    // Preferência de sistema e movimento reduzido, incluindo alterações em tempo real.
    for (const theme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await visit('foundations--default', 'system');
      await expect(page.locator('.theme-frame')).toHaveAttribute('data-preview-theme', theme);
      expect(await page.locator('.qf-skeleton').evaluateAll(elements => elements.every(el => getComputedStyle(el).animationName === 'none'))).toBe(true);
      const themeCheck = await page.evaluate(theme => {
        const frame = document.querySelector('.theme-frame');
        frame.removeAttribute('data-preview-theme');
        document.documentElement.dataset.theme = theme;
        const surface = document.querySelector('.qf-surface');
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
      await expect(page.locator('.qf-dice__total').first()).toHaveAttribute('data-reduced-motion', 'true');
      await expect(page.locator('.qf-dice__total').first()).toHaveCSS('transform', 'none');
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await visit('componentes-diceresult--natural-20');
    await expect(page.locator('.qf-dice__total').first()).toHaveAttribute('data-reduced-motion', 'false');
    await expect(page.locator('.qf-dice__total').first()).toHaveCSS('transform', 'none');
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
}
