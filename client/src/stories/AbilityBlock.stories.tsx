import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AbilityBlock } from '../components/AbilityBlock';

const meta = {
  title: 'Componentes/AbilityBlock',
  component: AbilityBlock,
  args: {
    label: 'Destreza',
    abbreviation: 'DES',
    score: 14,
    modifier: 2,
    saveBonus: 2,
    saveProficient: false,
    skills: [
      { skill: 'acrobatics', label: 'Acrobacia', bonus: 4, proficiency: 'proficient' },
      { skill: 'stealth', label: 'Furtividade', bonus: 2, proficiency: 'none' },
      { skill: 'sleightOfHand', label: 'Prestidigitação', bonus: 6, proficiency: 'expert' },
    ],
  },
  decorators: [(Story) => <div style={{ maxWidth: 260 }}><Story /></div>],
} satisfies Meta<typeof AbilityBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Consulta: Story = {};

export const Rolavel: Story = {
  name: 'Rolável pelo dono',
  args: { onCheck: fn(), onSave: fn(), onSkill: fn() },
  play: async ({ canvasElement, args }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('button', { name: 'Teste de Prestidigitação (+6, especialista)' }));
    }
    await expect(args.onSkill).toHaveBeenCalledWith('sleightOfHand');
  },
};

export const SemPericias: Story = {
  name: 'Constituição (sem perícias)',
  args: { label: 'Constituição', abbreviation: 'CON', score: 19, modifier: 4, saveBonus: 6, saveProficient: true, skills: [] },
};

export const Negativo: Story = {
  args: {
    label: 'Inteligência', abbreviation: 'INT', score: 9, modifier: -1, saveBonus: -1, saveProficient: false,
    skills: [{ skill: 'arcana', label: 'Arcanismo', bonus: -1, proficiency: 'none' }],
    onCheck: fn(), onSave: fn(), onSkill: fn(), disabled: true,
  },
};
