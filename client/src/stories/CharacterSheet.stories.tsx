import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { keepsConcentration, type CharacterSheet, type CharacterStateInput } from '@quest-fast/shared';
import { CharacterSheetView } from '../screens/campaign/CharacterSheetView';
import { hazinDan, lyraVentoclaro } from './fixtures/characters';

const noop = () => {};
const handlers = {
  onRoll: noop,
  onEdit: noop,
  onAskDelete: noop,
  onCancelDelete: noop,
  onConfirmDelete: noop,
};

/** What the server does with a state change, so the controls work in the lab. */
function applyState(character: CharacterSheet, state: CharacterStateInput): CharacterSheet {
  const { spellSlotsSpent, ...rest } = state;
  const hpCurrent = rest.hpCurrent ?? character.hpCurrent;
  return {
    ...character,
    ...rest,
    // Like the server: the fall ends a concentration.
    concentrating: keepsConcentration(rest.concentrating ?? character.concentrating, hpCurrent),
    spellSlots: spellSlotsSpent
      ? character.spellSlots.map((slot, circle) => ({ ...slot, spent: spellSlotsSpent[circle] ?? slot.spent }))
      : character.spellSlots,
  };
}

type SheetProps = Parameters<typeof CharacterSheetView>[0] & { interactive?: boolean };

function Sheet({ interactive = true, ...props }: SheetProps) {
  const [character, setCharacter] = useState(props.character);
  return (
    <CharacterSheetView {...props} character={character}
      onStateChange={interactive && props.isOwner ? (state) => setCharacter((current) => applyState(current, state)) : undefined} />
  );
}

const meta = {
  title: 'Composições/Ficha de personagem',
  component: Sheet,
  args: { character: hazinDan, isOwner: true, canDelete: true, ...handlers },
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dono: Story = { name: 'Dono da ficha (Hazin Dan)' };

export const Consulta: Story = {
  name: 'Consulta (mestre)',
  args: { isOwner: false, canDelete: true },
};

export const Convidado: Story = {
  name: 'Consulta (outro jogador)',
  args: { isOwner: false, canDelete: false },
};

export const NaGaleria: Story = {
  name: 'Dono em Meus personagens: gerencia, não joga',
  args: { context: 'gallery' },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const sheet = within(region);
    await expect(sheet.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Excluir' })).toBeVisible();
    await expect(sheet.queryByRole('button', { name: 'Dano' })).toBeNull();
    await expect(sheet.queryByRole('form', { name: /Aplicar condição/ })).toBeNull();
    await expect(sheet.queryByRole('button', { name: /^Teste de / })).toBeNull();
    await expect(sheet.getByText(/mudam na Mesa da campanha/)).toBeVisible();
  },
};

export const SoLeitura: Story = {
  name: 'Dono na Visão geral: só leitura',
  args: { context: 'read', canDelete: true },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const sheet = within(region);
    for (const name of ['Editar', 'Excluir', 'Dano', 'Cura']) {
      await expect(sheet.queryByRole('button', { name })).toBeNull();
    }
    await expect(sheet.queryByRole('form', { name: /Aplicar condição/ })).toBeNull();
    await expect(sheet.queryByRole('button', { name: /^Teste de / })).toBeNull();
  },
};

export const Conjuradora: Story = {
  name: 'Magias (conjuradora)',
  args: { character: lyraVentoclaro },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('tab', { name: 'Magias' }));
      await expect(within(region).getByRole('tab', { name: 'Magias' })).toHaveAttribute('aria-selected', 'true');
      await expect(within(region).getByText('Espíritos Guardiões')).toBeVisible();
    }
  },
};

export const Inventario: Story = {
  name: 'Inventário e história',
  args: { character: lyraVentoclaro },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('tab', { name: 'Inventário e história' }));
      await expect(within(region).getByText('Amuleto da Saúde')).toBeVisible();
    }
  },
};

export const DanoNaSessao: Story = {
  name: 'Dano registrado na consulta',
  args: { character: lyraVentoclaro },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const hitPoints = within(within(region).getByRole('region', { name: 'Pontos de vida' }));
      // 5 temporary points soak the first 5 of 7 damage: 22 becomes 20.
      await userEvent.type(hitPoints.getByLabelText('Quantidade'), '7');
      await userEvent.click(hitPoints.getByRole('button', { name: 'Dano' }));
      await expect(hitPoints.getByText('20')).toBeVisible();
    }
  },
};

export const Caido: Story = {
  name: 'Caído, com salvaguardas contra a morte',
  args: { character: { ...hazinDan, hpCurrent: 0, deathSaves: { successes: 1, failures: 2 } } },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const sheet = within(region);
      // Unconscious at 0: nobody starts concentrating; healed, the choice is back.
      await expect(sheet.queryByRole('button', { name: 'Marcar concentração' })).toBeNull();
      const hitPoints = within(sheet.getByRole('region', { name: 'Pontos de vida' }));
      await userEvent.type(hitPoints.getByLabelText('Quantidade'), '3');
      await userEvent.click(hitPoints.getByRole('button', { name: 'Cura' }));
      await expect(sheet.getByRole('button', { name: 'Marcar concentração' })).toBeVisible();
    }
  },
};

export const CaidoConcentrando: Story = {
  name: 'Caído com uma concentração ainda marcada',
  args: { character: { ...hazinDan, hpCurrent: 0, concentrating: true } },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      const sheet = within(region);
      await userEvent.click(sheet.getByRole('button', { name: 'Encerrar concentração' }));
      await expect(sheet.queryByRole('button', { name: /concentração/ })).toBeNull();
    }
  },
};

export const FichaLonga: Story = {
  name: 'Nome extenso e muitos ataques',
  args: {
    character: {
      ...hazinDan,
      name: 'Hazin Dan, o machado que atravessou as Planícies de Cinza',
      ownerName: 'Daniel de Alencar Figueiredo',
      subclass: 'Caminho do Berserker das Montanhas do Norte',
      attacks: [
        ...hazinDan.attacks,
        { kind: 'attack', name: 'Arremesso de machadinha em fúria', bonus: 7, damage: '1d6+7', damageType: 'Cortante', notes: 'Com Fúria ativa' },
        { kind: 'attack', name: 'Soco', bonus: 7, damage: '1+5', damageType: 'Contundente', notes: '' },
      ],
    },
  },
};

export const ConfirmarExclusao: Story = {
  name: 'Confirmando exclusão',
  args: { confirmingDelete: true },
};

export const Rolando: Story = {
  name: 'Rolagem em andamento',
  args: { rolling: true },
};

export const ResultadoDaRolagem: Story = {
  name: 'Resultado da rolagem',
  args: {
    lastRoll: {
      kind: 'roll',
      expression: '1d20+2',
      mode: 'advantage',
      total: 20,
      modifier: 2,
      dice: [
        { sides: 20, value: 18 },
        { sides: 20, value: 11, discarded: true },
      ],
      rollKind: 'initiative',
      ability: 'dexterity',
      characterName: 'Hazin Dan',
    },
  },
};

export const ErroNaRolagem: Story = {
  name: 'Erro na rolagem',
  args: { rollError: 'Não foi possível rolar agora. Tente de novo.' },
};
