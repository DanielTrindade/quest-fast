import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar } from '../components/Avatar';

const meta = { title: 'Componentes/Avatar', component: Avatar, args: { name: 'Lia Martins' } } satisfies Meta<typeof Avatar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Iniciais: Story = {};
export const Imagem: Story = { args: { src: '/avatar-example.png' } };
export const Carregando: Story = { args: { loading: true } };
export const ImagemIndisponivel: Story = { name: 'Imagem indisponível', args: { src: '/imagem-ausente.png' } };
export const Personagem: Story = { args: { name: 'Elara Sombravil', src: '/portraits/elara-example.png', variant: 'character', size: 'lg' } };
export const TokenSemRetrato: Story = { name: 'Token sem retrato', args: { name: 'Bram Linha Longa', variant: 'character', size: 'md' } };
export const TokenCarregando: Story = { name: 'Token carregando', args: { name: 'Elara Sombravil', variant: 'character', size: 'lg', loading: true } };
