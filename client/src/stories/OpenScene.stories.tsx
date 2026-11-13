import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ArrowRight } from '@phosphor-icons/react';
import { Button } from '../components/Button';
import { OpenScene } from '../components/OpenScene';
import { SYNTHETIC_MAP, syntheticMapUrl } from './fixtures/maps';

const meta = {
  title: 'Componentes/OpenScene',
  component: OpenScene,
  args: { scene: null, isMaster: false },
  decorators: [(Story) => <div style={{ maxWidth: 820 }}><Story /></div>],
} satisfies Meta<typeof OpenScene>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region);
}

const toTable = <Button>Ir para a Mesa <ArrowRight size={18} aria-hidden="true" /></Button>;

export const Aberto: Story = {
  render: (args) => (
    <OpenScene {...args} action={toTable}
      scene={{ name: 'Salão em ruínas', mapUrl: syntheticMapUrl(), mapWidth: SYNTHETIC_MAP.width, mapHeight: SYNTHETIC_MAP.height }} />
  ),
  play: async ({ canvasElement }) => {
    const card = firstTheme(canvasElement);
    await expect(card.getByText('Aberto para a mesa')).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Salão em ruínas' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Ir para a Mesa' })).toBeVisible();
  },
};

export const NomeLongo: Story = {
  name: 'Nome longo',
  render: (args) => (
    <OpenScene {...args} action={toTable}
      scene={{ name: 'Covil do dragão verde sob as Colinas do Crepúsculo, terceiro nível', mapUrl: syntheticMapUrl(), mapWidth: 2048, mapHeight: 4096 }} />
  ),
};

export const FechadoJogador: Story = {
  name: 'Fechado (jogador)',
  play: async ({ canvasElement }) => {
    const card = firstTheme(canvasElement);
    await expect(card.getByText(/Quando o mestre abrir um mapa, ele aparece na Mesa/)).toBeVisible();
  },
};

export const FechadoMestre: Story = {
  name: 'Fechado (mestre)',
  args: { isMaster: true, action: <Button variant="secondary">Ir para o Preparo</Button> },
  play: async ({ canvasElement }) => {
    const card = firstTheme(canvasElement);
    await expect(card.getByRole('button', { name: 'Ir para o Preparo' })).toBeVisible();
  },
};
