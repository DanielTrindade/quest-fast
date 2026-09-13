import type { CSSProperties, ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fn, expect, userEvent, within } from 'storybook/test';
import type { CharacterSheet } from '@quest-fast/shared';
import { CharacterForm } from '../components/CharacterForm';
import '../styles/campaign.css';

const base: CharacterSheet = {
  id: 'elara',
  campaignId: 'phandalin',
  ownerId: 'ana',
  ownerName: 'Ana Beatriz',
  name: 'Elara Sombravil',
  race: 'Meio-elfa',
  class: 'Ladina',
  level: 3,
  abilityScores: { strength: 10, dexterity: 18, constitution: 13, intelligence: 12, wisdom: 8, charisma: 14 },
  hp: 24,
  ac: 15,
  skills: ['stealth', 'perception', 'acrobatics', 'sleightOfHand'],
  saves: ['dexterity', 'intelligence'],
  attacks: [{ name: 'Adaga', bonus: 7, damage: '1d4+4' }],
  features: ['Ataque Furtivo 2d6', 'Ação Ladina'],
  description: 'Cresceu entre as caravanas do norte e aprendeu a ler fechaduras antes de ler mapas.',
  avatarUrl: '/portraits/elara-example.png',
  avatarAssetId: 'portrait',
};

const frameStyle: CSSProperties = {
  maxWidth: 720,
  maxHeight: 620,
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

export const Edicao: Story = { name: 'Edição', args: { character: base } };

export const FichaLonga: Story = {
  name: 'Ficha longa',
  args: {
    character: {
      ...base,
      name: 'Elara Sombravil, guardiã dos caminhos esquecidos',
      attacks: [
        { name: 'Adaga', bonus: 7, damage: '1d4+4' },
        { name: 'Besta de mão', bonus: 7, damage: '1d6+4' },
        { name: 'Espada curta élfica', bonus: 6, damage: '1d6+4 perfurante' },
        { name: 'Adaga envenenada', bonus: 7, damage: '1d4+4 mais 2d6 de veneno' },
      ],
      features: ['Ataque Furtivo 2d6', 'Ação Ladina', 'Especialização em Furtividade', 'Visão no Escuro 18 m'],
      description: 'Cresceu entre as caravanas do norte e aprendeu a ler fechaduras antes de ler mapas. Carrega uma chave de cobre que não abre nada que ela conheça.',
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
      await expect(within(region).getByText('Informe a raça.')).toBeVisible();

      // Fixing one field clears only its error.
      const name = within(region).getByLabelText('Nome');
      await userEvent.type(name, 'Kaelen');
      await expect(within(region).getByText('Informe o nome do personagem.')).not.toBeVisible();
      await expect(within(region).getByText('Informe a raça.')).toBeVisible();
    }
  },
};

export const Ataques: Story = {
  name: 'Ataques',
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('button', { name: /Adicionar ataque/ }));
      const attack = within(within(region).getByRole('group', { name: 'Ataque 1' }));

      // A negative bonus must survive the "-" typed before the digit, and a
      // cleared field must stay empty instead of snapping back to 0.
      const bonus = attack.getByLabelText('Bônus');
      await userEvent.clear(bonus);
      await expect(bonus).toHaveValue(null);
      await userEvent.type(bonus, '-2');
      await expect(bonus).toHaveValue(-2);

      await userEvent.type(attack.getByLabelText('Dano'), '1d4+4');
      await expect(attack.getByLabelText('Dano')).toHaveValue('1d4+4');

      await userEvent.click(attack.getByRole('button', { name: 'Remover ataque 1' }));
      await expect(within(region).queryByRole('group', { name: 'Ataque 1' })).toBeNull();

      // Typing scrolled the frame; content left under the sticky footer makes
      // the contrast audit inconclusive, so the story ends where it started.
      region.querySelector('.qf-page')?.scrollTo(0, 0);
    }
  },
};