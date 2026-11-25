import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { EffectForm } from '../components/EffectForm';

const meta = {
  title: 'Componentes/EffectForm',
  component: EffectForm,
  args: {
    caster: { id: 'cleric', name: 'Irmã Lúcia', concentrating: true },
    bearers: [{ id: 'cleric', name: 'Irmã Lúcia' }, { id: 'hazin', name: 'Hazin Dan' }, { id: 'nym', name: 'Nym Folhaclara' }],
    onApply: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof EffectForm>;
export default meta;
type Story = StoryObj<typeof meta>;

function formIn(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** The cleric puts Shield of Faith on the fighter, held by her concentration. */
export const EscudoDaFeNoAliado: Story = {
  name: 'Escudo da Fé no aliado',
  play: async ({ canvasElement, args }) => {
    const form = formIn(canvasElement);
    await userEvent.selectOptions(form.getByLabelText('Em quem'), 'hazin');
    await userEvent.type(form.getByLabelText('Nome do efeito'), 'Escudo da Fé');
    await userEvent.selectOptions(form.getByLabelText('CA'), 'add');
    await userEvent.type(form.getByLabelText('Bônus de CA'), '2');
    await userEvent.selectOptions(form.getByLabelText('Duração'), 'rounds');
    await userEvent.type(form.getByLabelText('Rodadas'), '100');
    await userEvent.click(form.getByLabelText('Acaba com a concentração de Irmã Lúcia'));
    await userEvent.click(form.getByRole('button', { name: 'Aplicar efeito de Irmã Lúcia' }));
    await expect(args.onApply).toHaveBeenCalledWith('hazin', {
      name: 'Escudo da Fé', modifiers: { ac: { mode: 'add', value: 2 } }, duration: 'rounds', roundsLeft: 100,
      sourceCombatantId: 'cleric', concentration: true,
    });
  },
};

/** Resistances pick their damage types. */
export const PeleDePedra: Story = {
  name: 'Pele de Pedra',
  play: async ({ canvasElement, args }) => {
    const form = formIn(canvasElement);
    await userEvent.type(form.getByLabelText('Nome do efeito'), 'Pele de Pedra');
    await userEvent.selectOptions(form.getByLabelText('Dano'), 'resistances');
    for (const type of ['concussão', 'perfurante', 'cortante']) await userEvent.click(form.getByLabelText(type));
    await userEvent.click(form.getByRole('button', { name: 'Aplicar efeito de Irmã Lúcia' }));
    await expect(args.onApply).toHaveBeenCalledWith('cleric', {
      name: 'Pele de Pedra', modifiers: { resistances: ['bludgeoning', 'piercing', 'slashing'] }, duration: 'encounter',
      sourceCombatantId: 'cleric', concentration: false,
    });
  },
};

/** A form that changes nothing says so before asking the server. */
export const SemModificador: Story = {
  name: 'Sem modificador',
  play: async ({ canvasElement, args }) => {
    const form = formIn(canvasElement);
    await userEvent.type(form.getByLabelText('Nome do efeito'), 'Nada');
    await userEvent.click(form.getByRole('button', { name: 'Aplicar efeito de Irmã Lúcia' }));
    await expect(form.getByRole('alert')).toHaveTextContent('O efeito precisa mudar alguma coisa.');
    await expect(args.onApply).not.toHaveBeenCalled();
  },
};

/** Without concentration, the box waits for it; on their own, no "Em quem". */
export const SemConcentracao: Story = {
  name: 'Sem concentração, só em si',
  args: { caster: { id: 'hazin', name: 'Hazin Dan', concentrating: false }, bearers: [{ id: 'hazin', name: 'Hazin Dan' }] },
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await expect(form.getByLabelText('Acaba com a concentração de Hazin Dan')).toBeDisabled();
    await expect(form.queryByLabelText('Em quem')).toBeNull();
  },
};
