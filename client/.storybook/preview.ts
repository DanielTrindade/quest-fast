import type { Preview } from '@storybook/react-vite';
import { Fragment, createElement } from 'react';
import { useGlobals } from 'storybook/preview-api';
import { DataToggle } from '../src/stories/DataToggle';
import { ThemePreview } from './ThemePreview';
import '../src/styles/index.css';
import './preview.css';

const preview: Preview = {
  decorators: [(Story, context) => {
    const [globals, updateGlobals] = useGlobals();
    const themed = createElement(ThemePreview, { mode: context.globals.theme, children: createElement(Story) });
    if (!context.parameters.dataToggle) return themed;
    return createElement(Fragment, null, themed, createElement(DataToggle, {
      value: globals.data ?? 'demo',
      onChange: (data: string) => updateGlobals({ data }),
    }));
  }],
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
    data: {
      description: 'Dados das telas do laboratório',
      toolbar: {
        title: 'Dados',
        icon: 'database',
        dynamicTitle: true,
        items: [
          { value: 'demo', title: 'Demo' },
          { value: 'worst', title: 'Pior caso' },
          { value: 'empty', title: 'Vazio' },
          { value: 'one', title: 'Um' },
          { value: 'huge', title: 'Muitos' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'both', data: 'demo' },
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    controls: { hideNoControlsWarning: true },
    a11y: { test: 'error' },
  },
};

export default preview;
