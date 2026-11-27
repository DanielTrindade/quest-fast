import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SummonForm } from '../components/SummonForm';

const meta = {
  title: 'Componentes/SummonForm',
  component: SummonForm,
  args: {
    summoner: { id: 'c-hazin', name: 'Hazin Dan', concentrating: true },
    onSummon: fn(),
    onCancel: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 420 }}><Story /></div>],
} satisfies Meta<typeof SummonForm>;
export default meta;
type Story = StoryObj<typeof meta>;

function formIn(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** Invocar Construto: the spirit with its slam, held by the concentration, right after Hazin. */
export const InvocarConstruto: Story = {
  play: async ({ canvasElement, args }) => {
    const form = formIn(canvasElement);
    await userEvent.type(form.getByLabelText(/Nome da invocação/), 'Espírito do Construto');
    await userEvent.type(form.getByLabelText(/^CA/), '16');
    await userEvent.type(form.getByLabelText(/^PV/), '40');
    await userEvent.click(form.getByRole('button', { name: 'Adicionar ataque' }));
    await userEvent.type(form.getByLabelText('Nome do ataque 1'), 'Pancada');
    await userEvent.type(form.getByLabelText('Bônus'), '6');
    await userEvent.type(form.getByLabelText('Dano'), '1d8+4');
    await userEvent.type(form.getByLabelText('Tipo de dano'), 'Contundente');
    await userEvent.click(form.getByLabelText('Some quando Hazin Dan perder a concentração'));
    await userEvent.type(form.getByLabelText('Duração em rodadas (opcional)'), '100');
    await userEvent.click(form.getByRole('button', { name: 'Invocar' }));
    await expect(args.onSummon).toHaveBeenCalledWith({
      source: 'summon',
      sheet: {
        name: 'Espírito do Construto', size: 'medium', ac: 16, hp: 40, speed: 9, initiativeBonus: 0,
        attacks: [{ kind: 'attack', name: 'Pancada', bonus: 6, damage: '1d8+4', damageType: 'Contundente' }],
      },
      summon: { summonerId: 'c-hazin', initiativeMode: 'withSummoner', concentration: true, rounds: 100 },
    });
  },
};

/** An empty sheet says what is missing next to each field, and asks nothing. */
export const Incompleta: Story = {
  play: async ({ canvasElement, args }) => {
    const form = formIn(canvasElement);
    await userEvent.click(form.getByRole('button', { name: 'Invocar' }));
    await expect(form.getByText('Informe o nome da invocação.')).toBeVisible();
    await expect(form.getByText(/CA deve ser um número/)).toBeVisible();
    await expect(args.onSummon).not.toHaveBeenCalled();
  },
};

/** Without concentration, the summon cannot be tied to it. */
export const SemConcentracao: Story = {
  name: 'Sem concentração',
  args: { summoner: { id: 'c-hazin', name: 'Hazin Dan', concentrating: false } },
  play: async ({ canvasElement }) => {
    const form = formIn(canvasElement);
    await expect(form.getByLabelText('Hazin Dan não está concentrando')).toBeDisabled();
  },
};

/** The server refused: its reason shows, and what was typed stays. */
export const Recusada: Story = {
  args: { error: 'Limite de 12 invocações por conjurador.' },
  play: async ({ canvasElement }) => {
    await expect(formIn(canvasElement).getByRole('alert')).toHaveTextContent('Limite de 12 invocações por conjurador.');
  },
};

export const Enviando: Story = { args: { pending: true } };
