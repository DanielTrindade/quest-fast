const RAW_COLOR = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i;
const PALETTE = /(?:^|[\s:!])(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|outline|fill|stroke|shadow|decoration|accent|caret|divide|from|via|to)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b|(?:^|[\s:!])(?:bg|text|border|ring|fill|stroke|shadow|from|via|to)-(?:white|black)\b/i;
const ARBITRARY = /(?:bg|text|border|ring|outline|fill|stroke|decoration|accent|caret)-\[([a-z]+)\]/i;
const COLOR_PROP = /^(?:color|background(?:Color)?|border(?:Top|Right|Bottom|Left)?Color|outlineColor|fill|stroke|accentColor|caretColor|textDecorationColor)$/;
const SEMANTIC = /^(?:var\(--color-[\w-]+\)|currentColor|transparent|inherit|initial|unset|revert|none)$/i;

export const rules = {
  'no-raw-color': {
    meta: {
      type: 'problem', schema: [],
      docs: { description: 'Exige tokens semânticos para cores de componentes.' },
      messages: { rawColor: 'Cor crua "{{value}}". Use os tokens semânticos de src/styles/index.css.', labTheme: 'data-preview-theme é exclusivo do laboratório em .storybook.' },
    },
    create(context) {
      const reported = new WeakSet();
      function report(node, value) {
        if (reported.has(node)) return;
        reported.add(node);
        context.report({ node, messageId: 'rawColor', data: { value } });
      }
      function inspect(node, value) {
        if (RAW_COLOR.test(value) || PALETTE.test(value) || ARBITRARY.test(value)) report(node, value);
      }
      function inspectColor(node, visited = new Set()) {
        if (!node || visited.has(node)) return;
        visited.add(node);
        if (node?.type === 'Literal' && typeof node.value === 'string' && !SEMANTIC.test(node.value)) report(node, node.value);
        if (node.type === 'Identifier') {
          let scope = context.sourceCode.getScope(node);
          while (scope) {
            const variable = scope.set.get(node.name);
            if (variable) {
              for (const definition of variable.defs) inspectColor(definition.node.init, visited);
              break;
            }
            scope = scope.upper;
          }
        }
        if (node.type === 'ConditionalExpression') { inspectColor(node.consequent, visited); inspectColor(node.alternate, visited); }
        if (node.type === 'TSAsExpression') inspectColor(node.expression, visited);
      }
      return {
        Literal(node) { if (typeof node.value === 'string') inspect(node, node.value); },
        TemplateElement(node) { inspect(node, node.value.cooked ?? ''); },
        Property(node) {
          const name = node.key.name ?? node.key.value;
          if (COLOR_PROP.test(name ?? '')) inspectColor(node.value);
        },
        JSXAttribute(node) {
          if (node.name.name === 'data-preview-theme') context.report({ node, messageId: 'labTheme' });
          if (COLOR_PROP.test(node.name.name ?? '')) {
            inspectColor(node.value?.type === 'JSXExpressionContainer' ? node.value.expression : node.value);
          }
        },
      };
    },
  },
};
