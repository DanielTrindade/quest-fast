import type { CSSProperties, ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, expect, userEvent, within } from 'storybook/test';
import { sheetFromOfficialPdf } from '@quest-fast/shared';
import { CharacterForm } from '../components/CharacterForm';
import { hazinDan, lyraVentoclaro } from './fixtures/characters';
import '../styles/campaign.css';

const pdf = new File(['%PDF-1.7'], 'Ficha_Hazin_Dan.pdf', { type: 'application/pdf' });

// The official sheet's fields, through the real parser: the spell name could
// not be read and the initiative needs an adjustment beyond the app's bounds.
const NUMBER = 'Números Centralizados HV';
const partialImport = sheetFromOfficialPdf(
  {
    'Esquerda Centro Single 12': 'Hazin Dan',
    'Esquerda Centro Single 12_3': 'Bárbaro',
    'Esquerda Centro Single 12_5': 'Humano',
    [`${NUMBER} 8 Single_2`]: '4',
    [`${NUMBER} 8 Single_4`]: '17',
    [`${NUMBER} 8 Single_15`]: '20',
    [`${NUMBER} 8 Single_13`]: '14',
    [`${NUMBER} 8 Single_11`]: '19',
    [`${NUMBER} 8 Single_5`]: '9',
    [`${NUMBER} 8 Single_7`]: '12',
    [`${NUMBER} 8 Single_9`]: '10',
    [`${NUMBER} 12 Single_2`]: '+14',
    'Esquerda baixo 12_5': '55',
    ...Object.fromEntries(['Text1', 'Text10', 'Text11', 'Text12', 'Text13', 'Text14', 'Text15', 'Text16', 'Text17'].map((name) => [name, ''])),
  },
  ['Magias Esq'],
);

const frameStyle: CSSProperties = {
  maxWidth: 760,
  maxHeight: 640,
  overflow: 'auto',
  padding: 24,
  background: 'var(--color-surface-overlay)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: 10,
  '--qf-dialog-pad': '24px',
} as CSSProperties;

// The form uses useMutation for saving; the lab provides an isolated client.
const queryClient = new QueryClient();

function Frame(props: ComponentProps<typeof CharacterForm>) {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="qf-page" style={frameStyle}>
        <CharacterForm {...props} />
      </div>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Componentes/CharacterForm',
  component: Frame,
  args: {
    campaignId: 'phandalin',
    character: null,
    onSaved: fn(),
    onRequestClose: fn(),
  },
} satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NovoPersonagem: Story = { name: 'Novo personagem' };

export const Edicao: Story = { name: 'Edição (Hazin Dan)', args: { character: hazinDan } };

export const Magias: Story = {
  name: 'Magias da conjuradora',
  args: { character: lyraVentoclaro },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('tab', { name: 'Magias' }));
      await expect(within(region).getByRole('group', { name: 'Magia 7' })).toBeVisible();
    }
  },
};

export const FichaLonga: Story = {
  name: 'Ficha longa',
  args: {
    character: {
      ...hazinDan,
      name: 'Hazin Dan, o machado que atravessou as Planícies de Cinza',
      attacks: [
        ...hazinDan.attacks,
        { name: 'Arremesso de machadinha em fúria', bonus: 7, damage: '1d6+7', damageType: 'Cortante', notes: 'Com Fúria ativa' },
        { name: 'Soco', bonus: 7, damage: '1+5', damageType: 'Contundente', notes: '' },
      ],
    },
  },
};

export const ValidacaoNoCampo: Story = {
  name: 'Validação por campo',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      // Submitting an empty new sheet shows every required-field error inline.
      await userEvent.click(within(region).getByRole('button', { name: 'Criar personagem' }));
      await expect(within(region).getByText('Informe o nome do personagem.')).toBeVisible();
      await expect(within(region).getByText('Informe a espécie.')).toBeVisible();

      // Fixing one field clears only its error.
      const name = within(region).getByLabelText(/Nome do personagem/);
      await userEvent.type(name, 'Hazin Dan');
      await expect(within(region).queryByText('Informe o nome do personagem.')).toBeNull();
      await expect(within(region).getByText('Informe a espécie.')).toBeVisible();
    }
  },
};

export const ErroEmOutraAba: Story = {
  name: 'Erro em outra aba',
  args: { character: hazinDan },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('tab', { name: /Inventário e história/ }));
      const gold = within(region).getByLabelText('Ouro (PO)');
      await userEvent.clear(gold);
      await userEvent.click(within(region).getByRole('tab', { name: /Identidade e combate/ }));
      await userEvent.click(within(region).getByRole('button', { name: 'Salvar alterações' }));
      // The section with the error opens and says so.
      await expect(within(region).getByRole('tab', { name: /Inventário e história \(contém erro\)/ })).toHaveAttribute('aria-selected', 'true');
      await expect(gold).toHaveAttribute('aria-invalid', 'true');

      // Focus scrolled the frame to the coins; content left under the sticky
      // footer makes the contrast audit inconclusive, so end at the top.
      region.querySelector('.qf-page')?.scrollTo(0, 0);
    }
  },
};

export const Ataques: Story = {
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('tab', { name: /Ataques e características/ }));
      await userEvent.click(within(region).getByRole('button', { name: /Adicionar ataque/ }));
      const attack = within(within(region).getByRole('group', { name: 'Ataque 1' }));

      // A negative bonus must survive the "-" typed before the digit, and a
      // cleared field must stay empty instead of snapping back to 0.
      const bonus = attack.getByLabelText('Bônus');
      await userEvent.clear(bonus);
      await expect(bonus).toHaveValue(null);
      await userEvent.type(bonus, '-2');
      await expect(bonus).toHaveValue(-2);

      await userEvent.type(attack.getByLabelText(/^Dano/), '1d4+4');
      await expect(attack.getByLabelText(/^Dano/)).toHaveValue('1d4+4');

      await userEvent.click(attack.getByRole('button', { name: 'Remover ataque 1' }));
      await expect(within(region).queryByRole('group', { name: 'Ataque 1' })).toBeNull();

      // Typing scrolled the frame; content left under the sticky footer makes
      // the contrast audit inconclusive, so the story ends where it started.
      region.querySelector('.qf-page')?.scrollTo(0, 0);
    }
  },
};

export const ImportandoFicha: Story = {
  name: 'Importando ficha',
  // A read that never ends holds the form in the reading state.
  args: { readSheet: () => new Promise(() => {}) },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.upload(canvas.getByLabelText('Importar PDF'), pdf);
      await expect(canvas.getByLabelText(/Nome do personagem/)).toBeDisabled();
      await expect(canvas.getByRole('button', { name: 'Criar personagem' })).toBeDisabled();
      await expect(canvas.getAllByText('Importando ficha…')).toHaveLength(2);
      // The avatar does not come from the PDF, and leaving stays possible.
      await expect(canvas.getByLabelText('Enviar avatar')).toBeEnabled();
      await expect(canvas.getByRole('button', { name: 'Cancelar' })).toBeEnabled();

      // The submit handler is guarded too: an empty form submitted now would
      // otherwise show the required-field errors.
      region.querySelector('form')?.requestSubmit();
      await expect(canvas.queryByText('Informe o nome do personagem.')).toBeNull();
    }
  },
};

export const ImportacaoParcial: Story = {
  name: 'Importação com pontos para revisar',
  args: { readSheet: async () => partialImport },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const canvas = within(region);
      await userEvent.upload(canvas.getByLabelText('Importar PDF'), pdf);
      await expect(await canvas.findByText(/Ficha importada com pontos para revisar/)).toBeVisible();
      await expect(canvas.getByLabelText(/Nome do personagem/)).toHaveValue('Hazin Dan');
      await expect(canvas.getByRole('list', { name: 'Pontos para revisar' }).children).toHaveLength(2);
      // The adjustment is kept as written and marked before any submit.
      await expect(canvas.getByLabelText('Ajuste de iniciativa')).toHaveValue(12);
      await expect(canvas.getByLabelText('Ajuste de iniciativa')).toHaveAttribute('aria-invalid', 'true');

      region.querySelector('.qf-page')?.scrollTo(0, 0);
    }
  },
};
