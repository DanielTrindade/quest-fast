import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { InviteHero } from '../components/InviteHero';
import { inviteCard } from './fixtures/table';

const meta = {
  title: 'Componentes/InviteHero',
  component: InviteHero,
  args: {
    link: 'https://questfast.app/invite/K7Q29X',
    code: 'K7Q29X',
    campaignName: 'Ecos de Phandalin',
    previewUrl: inviteCard,
    onRotate: fn(),
    copy: fn(async () => {}),
  },
  decorators: [(Story) => <div style={{ maxWidth: 560 }}><Story /></div>],
} satisfies Meta<typeof InviteHero>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

export const Padrao: Story = {
  name: 'Padrão',
  play: async ({ canvasElement, args }) => {
    const panel = firstTheme(canvasElement);
    await expect(panel.getByText('K 7 Q 2 9 X')).toBeInTheDocument();
    await userEvent.click(panel.getByRole('button', { name: 'Copiar' }));
    await expect(args.copy).toHaveBeenCalledWith('https://questfast.app/invite/K7Q29X');
    await expect(panel.getByText('Link copiado. Compartilhe com sua mesa.')).toBeInTheDocument();
  },
};

export const FalhaAoCopiar: Story = {
  name: 'Falha ao copiar',
  args: { copy: fn(async () => { throw new Error('denied'); }) },
  play: async ({ canvasElement }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('button', { name: 'Copiar' }));
    await expect(panel.getByText(/Selecione o link e copie manualmente/)).toBeInTheDocument();
  },
};

/** Without the card image (or when it fails to load) the preview is left out. */
export const SemPrevia: Story = { name: 'Sem prévia', args: { previewUrl: undefined } };

export const TrocandoLink: Story = { name: 'Trocando o link', args: { rotating: true } };

export const ErroAoTrocar: Story = { name: 'Erro ao trocar', args: { rotating: false, rotateError: 'Não foi possível gerar um novo link.' } };

export const NomeLongo: Story = {
  name: 'Nome longo',
  args: {
    campaignName: 'Campanha🐉comumnomequenãoacabanuncaporquealguémesqueceudeusarespaços',
    link: 'https://questfast.app/invite/WWWWWW',
    code: 'WWWWWW',
  },
};
