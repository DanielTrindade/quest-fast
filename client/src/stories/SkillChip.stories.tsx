import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { SkillChip } from '../components/SkillChip';

function Example({ trained = true, rollable = false, disabled = false }: {
  trained?: boolean; rollable?: boolean; disabled?: boolean;
}) {
  const [rolled, setRolled] = useState(false);
  return (
    <div className="qf-stack" style={{ maxWidth: 300 }}>
      <SkillChip label="Furtividade" bonus={6} trained={trained}
        onRoll={rollable ? () => setRolled(true) : undefined} disabled={disabled} />
      <p className="text-small text-text-secondary" aria-live="polite">
        {rollable ? (rolled ? 'Teste rolado!' : 'Pronto para rolar.') : 'Consulta.'}
      </p>
    </div>
  );
}

const meta = { title: 'Componentes/SkillChip', component: Example } satisfies Meta<typeof Example>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Treinada: Story = { args: { trained: true } };
export const NaoTreinada: Story = { name: 'Não treinada', args: { trained: false } };
export const Rolavel: Story = { args: { rollable: true } };
export const Desabilitado: Story = { args: { rollable: true, disabled: true } };

export const Interativo: Story = {
  args: { rollable: true },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await userEvent.click(within(region).getByRole('button', { name: 'Rolar teste de Furtividade (+6)' }));
      await expect(within(region).getByText('Teste rolado!')).toBeVisible();
    }
  },
};