import type { Preview } from '@storybook/react-vite';
import { createElement } from 'react';
import { ThemePreview } from './ThemePreview';
import '../src/styles/index.css';
import './preview.css';

const preview: Preview = {
  decorators: [(Story, context) => createElement(ThemePreview, {
    mode: context.globals.theme,
    children: createElement(Story),
  })],
  globalTypes: {
    theme: {
      description: 'Tema de visualização',
      toolbar: {
        title: 'Comparar temas',
        icon: 'circlehollow',
        dynamicTitle: true,
        items: [
          { value: 'both', title: 'Comparar temas' },
          { value: 'dark', title: 'Escuro' },
          { value: 'light', title: 'Claro' },
          { value: 'system', title: 'Sistema' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'both' },
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    controls: { hideNoControlsWarning: true },
    a11y: { test: 'error' },
  },
};

export default preview;
