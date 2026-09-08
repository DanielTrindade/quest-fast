import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

// Cobre CSS, que não passa pelo parser JSX do ESLint. Cores só na fonte de tokens.
const root = resolve(import.meta.dirname, '..');
const tokens = resolve(root, 'client/src/styles/index.css');
const errors = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (path.endsWith('.css') && path !== tokens) {
      const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      if (/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i.test(source)) errors.push(relative(root, path));
      const declarations = source.matchAll(/(?:^|[;{])\s*(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?-color|fill|stroke)\s*:\s*([^;}]+)/g);
      for (const [, value] of declarations) {
        if (!/^(?:var\(--color-[\w-]+\)|transparent|currentColor|inherit|none)\s*$/.test(value)) errors.push(`${relative(root, path)}: ${value}`);
      }
    }
  }
}
walk(join(root, 'client/src'));
walk(join(root, 'client/.storybook'));
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log('CSS usa apenas tokens semânticos.');
