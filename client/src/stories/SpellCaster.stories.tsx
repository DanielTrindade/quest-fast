import { useState, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Button } from '../components/Button';
import { SpellCaster } from '../components/SpellCaster';
import { lyraVentoclaro } from './fixtures/characters';

const meta = {
  title: 'Componentes/SpellCaster',
  component: SpellCaster,
  args: {
    name: lyraVentoclaro.name,
    slots: lyraVentoclaro.spellSlots,
    spells: lyraVentoclaro.spells,
    concentrating: false,
    onChangeSlots: fn(),
    onCast: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 380 }}><Story /></div>],
} satisfies Meta<typeof SpellCaster>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** Bênção takes the lowest free slot unless another circle is chosen. */
export const Conjurar: Story = {
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Conjurar Bênção' }));
    const confirm = within(panel.getByRole('group', { name: 'Conjurar Bênção' }));
    await expect(confirm.getByRole('radio', { name: '1º círculo' })).toBeChecked();
    // The 3rd circle is spent: only the 1st and 2nd are offered.
    await expect(confirm.queryByRole('radio', { name: '3º círculo' })).toBeNull();
    await expect(confirm.getByText('Exige concentração: o personagem passa a se concentrar.')).toBeVisible();
    await userEvent.click(confirm.getByRole('radio', { name: '2º círculo' }));
    await userEvent.click(confirm.getByRole('button', { name: 'Conjurar Bênção' }));
    await expect(args.onCast).toHaveBeenLastCalledWith(3, 'Bênção', { circle: 2 });
  },
};

/** A ritual spell may be cast without a slot. */
export const Ritual: Story = {
  args: { concentrating: true },
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Conjurar Detectar Magia' }));
    const confirm = within(panel.getByRole('group', { name: 'Conjurar Detectar Magia' }));
    await expect(confirm.getByText('Exige concentração: a concentração atual termina.')).toBeVisible();
    await userEvent.click(confirm.getByRole('radio', { name: 'Como ritual' }));
    await userEvent.click(confirm.getByRole('button', { name: 'Conjurar Detectar Magia' }));
    await expect(args.onCast).toHaveBeenLastCalledWith(4, 'Detectar Magia', { ritual: true });
  },
};

/** Every slot of the spell's circle and above is spent: the button says why it is off. */
export const SemEspacos: Story = {
  name: 'Sem espaços',
  play: async ({ canvasElement }) => {
    const panel = firstTheme(canvasElement);
    await expect(panel.getByRole('button', { name: 'Conjurar Espíritos Guardiões' })).toBeDisabled();
    await expect(panel.getByText('Sem espaços do 3º círculo ou acima.')).toBeVisible();
  },
};

export const Erro: Story = { args: { error: 'Sem espaços livres do 2º círculo.' } };
export const Enviando: Story = { args: { pending: true } };

/** The sheet changes in another tab: a spell before the open one goes away. */
function EditedElsewhere(args: ComponentProps<typeof SpellCaster>) {
  const [spells, setSpells] = useState(args.spells);
  return (
    <div className="grid gap-3">
      <Button variant="ghost" onClick={() => setSpells((list) => list.filter((spell) => spell.name !== 'Curar Ferimentos'))}>
        Remover Curar Ferimentos da ficha
      </Button>
      <SpellCaster {...args} spells={spells} />
    </div>
  );
}

/** The open confirmation stays with its spell, never with its old place in the list. */
export const FichaMudaComConfirmacaoAberta: Story = {
  name: 'Ficha muda com a confirmação aberta',
  render: (args) => <EditedElsewhere {...args} />,
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Conjurar Bênção' }));
    await userEvent.click(panel.getByRole('button', { name: 'Remover Curar Ferimentos da ficha' }));
    await expect(panel.queryByRole('group', { name: 'Conjurar Detectar Magia' })).toBeNull();
    const confirm = within(panel.getByRole('group', { name: 'Conjurar Bênção' }));
    await userEvent.click(confirm.getByRole('button', { name: 'Conjurar Bênção' }));
    await expect(args.onCast).toHaveBeenLastCalledWith(2, 'Bênção', { circle: 1 });
  },
};
