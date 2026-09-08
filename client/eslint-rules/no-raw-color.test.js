import { RuleTester } from 'eslint';
import { rules } from './no-raw-color.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } } });
tester.run('no-raw-color', rules['no-raw-color'], {
  valid: [
    '<div className="bg-surface text-text-primary" />',
    '<div style={{ color: "var(--color-danger-text)" }} />',
    '<svg fill="currentColor" />',
    '<a href="#members">Membros</a>',
    '<div className="text-[13px]" />',
  ],
  invalid: [
    { code: '<div data-preview-theme="light" />', errors: [{ messageId: 'labTheme' }] },
    ...[
      '<div style={{ color: "red" }} />',
      '<div style={{ color: "rgb(0,0,0)" }} />',
      '<div style={{ color: "#fff" }} />',
      '<div className={"hover:bg-blue-500"} />',
      '<div className={`bg-white`} />',
      '<div className="text-[red]" />',
      'const color = "#123456"; <div style={{ color }} />',
      'const color = "red"; <div style={{ color }} />',
      '<svg fill={"rebeccapurple"} />',
      '<div className="ring-offset-red-500" />',
    ].map(code => ({ code, errors: [{ messageId: 'rawColor' }] })),
  ],
});
