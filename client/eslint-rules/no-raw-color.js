const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;

const COLOR_PROPS = new Set([
  'fill',
  'stroke',
  'color',
  'background',
  'backgroundColor',
  'borderColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'accentColor',
  'textColor',
  'boxShadow',
  'textShadow',
]);

function getStringValue(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral') {
    return node.quasis.map((quasi) => quasi.value.cooked).join('');
  }
  return null;
}

export const rules = {
  'no-raw-color': {
    meta: {
      type: 'problem',
      docs: {
        description:
          'Impede cor crua (hex) em componente, forcando o uso dos tokens semanticos --color-* de src/styles/index.css',
      },
      messages: {
        rawHex:
          'Cor crua "{{color}}" em componente. Use um token semantico (--color-*) de src/styles/index.css.',
      },
    },
    create(context) {
      function reportHex(node, value) {
        const match = HEX_PATTERN.exec(value);
        if (match) {
          context.report({ node, messageId: 'rawHex', data: { color: match[0] } });
        }
      }

      function walkStyleExpression(expression) {
        if (!expression) return;
        if (expression.type === 'Literal' && typeof expression.value === 'string') {
          reportHex(expression, expression.value);
        } else if (expression.type === 'TemplateLiteral') {
          for (const quasi of expression.quasis) {
            reportHex(expression, quasi.value.cooked ?? '');
          }
        } else if (expression.type === 'ObjectExpression') {
          for (const property of expression.properties) {
            if (property.type === 'Property') {
              walkStyleExpression(property.value);
            } else if (property.type === 'SpreadElement') {
              walkStyleExpression(property.argument);
            }
          }
        } else if (expression.type === 'ArrayExpression') {
          for (const element of expression.elements) {
            walkStyleExpression(element);
          }
        }
      }

      return {
        JSXAttribute(node) {
          const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
          if (!name) return;

          if (name === 'className' || name === 'class') {
            const value = getStringValue(node.value);
            if (value) reportHex(node, value);
          } else if (name === 'style') {
            if (node.value && node.value.type === 'JSXExpressionContainer') {
              walkStyleExpression(node.value.expression);
            }
          } else if (COLOR_PROPS.has(name)) {
            const value = getStringValue(node.value);
            if (value) reportHex(node, value);
            if (node.value && node.value.type === 'JSXExpressionContainer') {
              walkStyleExpression(node.value.expression);
            }
          }
        },
      };
    },
  },
};