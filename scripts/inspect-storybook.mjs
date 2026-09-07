// Diagnóstico local pelo navegador integrado. Não modifica dados do produto.
// Uso: node scripts/inspect-storybook.mjs <browserPageId> [screenshot.png]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = process.argv[2];
if (!page) throw new Error('Informe o browserPageId do Orca.');
const command = process.env.ORCA_CLI_COMMAND || 'orca';
const run = (args) => {
  const response = JSON.parse(execFileSync(command, [...args, '--page', page, '--json'], {
    encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 12 * 1024 * 1024,
  }));
  if (!response.ok) throw new Error(JSON.stringify(response.error));
  const result = response.result;
  return typeof result.result === 'string' ? JSON.parse(result.result) : result;
};

if (process.argv[3] === '--matrix') {
  const axePath = '/@fs/' + resolve('node_modules/axe-core/axe.min.js').replaceAll('\\', '/');
  const index = await fetch('http://localhost:6006/index.json').then(r => r.json());
  const stories = Object.values(index.entries).filter(entry => entry.type === 'story'
    && (!process.argv[4] || entry.id.includes(process.argv[4])));
  let failed = false;
  for (const story of stories) {
    const expression = `(async () => {
      document.getElementById('review-frame')?.remove();
      const frame = document.createElement('iframe');
      frame.id = 'review-frame';
      frame.title = 'Verificação responsiva';
      frame.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:844px;border:0;z-index:9999;background:var(--color-surface)';
      frame.src = '/iframe.html?id=' + ${JSON.stringify(story.id)} + '&viewMode=story';
      document.body.append(frame);
      await new Promise((resolve, reject) => {
        const deadline = Date.now() + 25000;
        const check = () => {
          if (frame.contentDocument?.querySelector('.theme-frame__panel')?.textContent.trim()) return resolve();
          if (Date.now() > deadline) return reject(new Error('Story não renderizada'));
          requestAnimationFrame(check);
        };
        check();
      });
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      await win.document.fonts.ready;
      await new Promise((resolve, reject) => {
        const script = doc.createElement('script');
        script.src = ${JSON.stringify(axePath)};
        script.onload = resolve;
        script.onerror = reject;
        doc.head.append(script);
      });
      const root = doc.querySelector('#storybook-root');
      const result = await win.axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
      const ids = [...root.querySelectorAll('[id]')].map(el => el.id);
      const widths = [];
      for (const width of [320, 390, 768, 1280]) {
        frame.style.width = width + 'px';
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        widths.push({ viewport: win.innerWidth, scrollWidth: doc.documentElement.scrollWidth });
      }
      const contrastFailures = [...root.querySelectorAll('.contrast-specimen')].filter(el => /Revisar|Calculando/.test(el.textContent)).map(el => el.textContent);
      const output = {
        story: ${JSON.stringify(story.id)}, widths,
        duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
        themes: [...root.querySelectorAll('.theme-frame')].map(el => el.dataset.theme),
        violations: result.violations.map(v => ({ id: v.id, count: v.nodes.length })),
        incomplete: result.incomplete.map(v => v.id), contrastFailures,
      };
      frame.remove();
      return output;
    })()`;
    let result;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { result = run(['eval', '--expression', expression]); break; }
      catch (error) {
        if (attempt === 2) throw error;
        console.log('Repetindo após interrupção do navegador: ' + story.id);
      }
    }
    failed ||= result.violations.length > 0 || result.duplicateIds.length > 0
      || result.contrastFailures.length > 0 || result.widths.some(w => w.scrollWidth > w.viewport);
    console.log(JSON.stringify(result));
  }
  process.exitCode = failed ? 1 : 0;
} else if (process.argv[3]) {
  const screenshot = run(['screenshot']);
  writeFileSync(resolve(process.argv[3]), Buffer.from(screenshot.data, 'base64'));
  console.log('Captura salva em ' + resolve(process.argv[3]));
} else {
  const axePath = '/@fs/' + resolve('node_modules/axe-core/axe.min.js').replaceAll('\\', '/');
  const expression = `(async () => {
    await document.fonts.ready;
    if (!window.axe) await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = ${JSON.stringify(axePath)};
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível carregar axe-core local.'));
      document.head.append(script);
    });
    const root = document.querySelector('#storybook-root');
    const ids = [...root.querySelectorAll('[id]')].map(el => el.id);
    const result = await axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return {
      viewport: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      duplicateIds: ids.filter((id, i) => ids.indexOf(id) !== i),
      language: document.documentElement.lang,
      fonts: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family),
      themes: [...root.querySelectorAll('.theme-frame')].map(el => ({ theme: el.dataset.theme, width: el.clientWidth })),
      contrast: [...root.querySelectorAll('.contrast-specimen')].map(el => el.innerText),
      violations: result.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
      incomplete: result.incomplete.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
      passes: result.passes.length,
    };
  })()`;
  console.log(JSON.stringify(run(['eval', '--expression', expression]), null, 2));
}
