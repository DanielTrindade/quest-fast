import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { AttackCard } from '../components/AttackCard';

const dagger = { name: 'Adaga', bonus: 7, damage: '1d4+4', onRoll: fn() };

const meta = { title: 'Componentes/AttackCard', component: AttackCard, args: dagger } satisfies Meta<typeof AttackCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Padrao: Story = { args: dagger };
export const ComTipoENotas: Story = {
  name: 'Com tipo de dano e notas',
  args: { ...dagger, name: 'Machado Grande Hetto', bonus: 7, damage: '1d12+5', damageType: 'Cortante', notes: 'Pesada, duas mãos' },
};
export const ComAlcance: Story = {
  name: 'Com alcance',
  args: { ...dagger, name: 'Machadinha', damageType: 'Cortante', notes: 'Leve, arremesso', range: '6/18 m' },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText('Alcance')).toBeVisible();
    await expect(within(region!).getByText('6/18 m')).toBeVisible();
  },
};
export const AlcanceNoLimite: Story = {
  name: 'Alcance no limite',
  args: { ...dagger, range: 'Toque, ou 18/36 m arremessada' },
};
/** In the Mesa, with its user on the map: the range can be drawn there. */
export const VerAlcance: Story = {
  name: 'Ver alcance',
  args: { ...dagger, name: 'Machadinha', range: '6/18 m', rangeToggle: { shown: false, toggle: fn() } },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const toggle = within(region!).getByRole('button', { name: 'Ver alcance de Machadinha no mapa' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(toggle);
    await expect(args.rangeToggle!.toggle).toHaveBeenCalled();
  },
};
export const AlcanceNoMapa: Story = {
  name: 'Alcance no mapa',
  args: { ...dagger, name: 'Machadinha', range: '6/18 m', rangeToggle: { shown: true, toggle: fn() } },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByRole('button', { name: 'Ocultar alcance de Machadinha no mapa' })).toHaveAttribute('aria-pressed', 'true');
  },
};
export const Consulta: Story = { args: { ...dagger, onRoll: undefined } };
export const Rolando: Story = { args: { ...dagger, disabled: true } };
export const NomeLongo: Story = { args: { ...dagger, name: 'Espada curta élfica dos caminhos esquecidos', bonus: -1, damage: '1d4+4 mais 2d6 de veneno' } };
export const Resistencia: Story = {
  name: 'Resistência (CD)',
  // The target rolls a save: the card shows the DC and rolls only the damage.
  args: {
    kind: 'save', name: 'Palavra Radiante', dc: 13, saveAbility: 'constitution', damage: '1d6', damageType: 'Radiante', onRoll: fn(),
  },
  play: async ({ canvasElement }) => {
    for (const region of within(canvasElement).getAllByRole('region', { name: /^Tema / })) {
      await expect(within(region).getByText('Constituição — CD 13')).toBeVisible();
      await expect(within(region).queryByRole('button', { name: /Atacar/ })).toBeNull();
      await expect(within(region).getByRole('button', { name: 'Rolar dano de Palavra Radiante' })).toBeVisible();
    }
  },
};
export const SalvaguardaSemDano: Story = {
  name: 'Salvaguarda sem dano',
  // Graxa imposes only its effect: the button calls for the save, nothing is rolled.
  args: { kind: 'save', name: 'Graxa', dc: 12, saveAbility: 'dexterity', damage: '', notes: 'Cai se falhar', onRoll: fn() },
  play: async ({ canvasElement, args }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const card = within(region!);
    await expect(card.getByText('Sem dano')).toBeVisible();
    await expect(card.queryByRole('button', { name: /Rolar dano/ })).toBeNull();
    await userEvent.click(card.getByRole('button', { name: 'Pedir salvaguarda de Graxa' }));
    await expect(args.onRoll).toHaveBeenCalled();
  },
};
export const ComCusto: Story = {
  name: 'Com custo',
  // An off-hand weapon spends the bonus action.
  args: { ...dagger, name: 'Adaga (mão inábil)', cost: 'bonusAction' },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    await expect(within(region!).getByText('Ação bônus')).toBeVisible();
  },
};
export const SemOQueGastar: Story = {
  name: 'Sem o que gastar no turno',
  // The turn has no bonus action left: the button is off and says why.
  args: { ...dagger, name: 'Adaga (mão inábil)', cost: 'bonusAction', refusal: 'A ação bônus deste turno já foi usada.' },
  play: async ({ canvasElement }) => {
    const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
    const card = within(region!);
    await expect(card.getByRole('button', { name: 'Atacar com Adaga (mão inábil)' })).toBeDisabled();
    await expect(card.getByText('A ação bônus deste turno já foi usada.')).toBeVisible();
  },
};
