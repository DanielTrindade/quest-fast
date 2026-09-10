import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CharacterSheet } from '@quest-fast/shared';
import { Surface } from '../components/Surface';
import { CharacterSheetView } from '../screens/campaign/CharacterSheetView';
import '../styles/campaign.css';

const base: CharacterSheet = {
  id: 'elara',
  campaignId: 'phandalin',
  ownerId: 'ana',
  ownerName: 'Ana Beatriz',
  name: 'Elara Sombravil',
  race: 'Meio-elfa',
  class: 'Ladina',
  level: 3,
  abilityScores: { strength: 10, dexterity: 18, constitution: 13, intelligence: 12, wisdom: 8, charisma: 14 },
  hp: 24,
  ac: 15,
  skills: ['stealth', 'perception', 'acrobatics', 'sleightOfHand'],
  saves: ['dexterity', 'intelligence'],
  attacks: [{ name: 'Adaga', bonus: 7, damage: '1d4+4' }],
  features: ['Ataque Furtivo 2d6', 'Ação Ladina'],
  description: 'Cresceu entre as caravanas do norte e aprendeu a ler fechaduras antes de ler mapas.',
  avatarUrl: '/portraits/elara-example.png',
  avatarAssetId: 'portrait',
};

const noop = () => {};
const handlers = {
  onRoll: noop,
  onEdit: noop,
  onAskDelete: noop,
  onCancelDelete: noop,
  onConfirmDelete: noop,
};

/** The dialog supplies the surface in the product; the lab does the same. */
function Sheet(props: Parameters<typeof CharacterSheetView>[0]) {
  return (
    <Surface variant="sheet">
      <CharacterSheetView {...props} />
    </Surface>
  );
}

const meta = {
  title: 'Composições/Ficha de personagem',
  component: Sheet,
  args: { character: base, isOwner: true, canDelete: true, ...handlers },
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Dono: Story = { name: 'Dono da ficha' };

export const Consulta: Story = {
  name: 'Consulta (mestre)',
  args: { isOwner: false, canDelete: true },
};

export const Convidado: Story = {
  name: 'Consulta (outro jogador)',
  args: { isOwner: false, canDelete: false },
};

export const FichaLonga: Story = {
  name: 'Nome extenso e muitos ataques',
  args: {
    character: {
      ...base,
      name: 'Elara Sombravil, guardiã dos caminhos esquecidos',
      ownerName: 'Ana Beatriz de Alencar Figueiredo',
      hp: 148,
      ac: 21,
      attacks: [
        { name: 'Adaga', bonus: 7, damage: '1d4+4' },
        { name: 'Besta de mão', bonus: 7, damage: '1d6+4' },
        { name: 'Espada curta élfica de Sombravil', bonus: 6, damage: '1d6+4 perfurante' },
        { name: 'Adaga envenenada', bonus: 7, damage: '1d4+4 mais 2d6 de veneno' },
        { name: 'Soco', bonus: -1, damage: '1' },
      ],
      features: ['Ataque Furtivo 2d6', 'Ação Ladina', 'Especialização em Furtividade', 'Visão no Escuro 18 m'],
      description:
        'Cresceu entre as caravanas do norte e aprendeu a ler fechaduras antes de ler mapas. Carrega uma chave de cobre que não abre nada que ela conheça, e por isso não a larga.',
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
      expression: '1d20+4',
      mode: 'advantage',
      total: 22,
      modifier: 4,
      dice: [
        { sides: 20, value: 18 },
        { sides: 20, value: 11, discarded: true },
      ],
      rollKind: 'check',
      ability: 'dexterity',
      characterName: 'Elara Sombravil',
    },
  },
};

export const ErroNaRolagem: Story = {
  name: 'Erro na rolagem',
  args: { rollError: 'Não foi possível rolar agora. Tente de novo.' },
};
