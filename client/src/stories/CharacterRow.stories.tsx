import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { CharacterSummary } from '@quest-fast/shared';
import { CharacterRow } from '../components/CharacterRow';
import '../styles/campaign.css';

const base: CharacterSummary = {
  id: 'elara',
  name: 'Elara Sombravil',
  race: 'Meio-elfa',
  class: 'Ladina',
  level: 3,
  ownerId: 'ana',
  ownerName: 'Ana Beatriz',
  avatarUrl: '/portraits/elara-example.png',
  hp: 24,
  ac: 15,
};

const another: CharacterSummary = {
  ...base,
  id: 'kaelen',
  name: 'Kaelen',
  race: 'Elfo',
  class: 'Ladino',
  level: 3,
  ownerId: 'rafael',
  ownerName: 'Rafael Costa',
  avatarUrl: null,
  hp: 18,
  ac: 14,
};

function List({ rows, mine = 'elara' }: { rows: CharacterSummary[]; mine?: string }) {
  return (
    <ul className="characters-list" style={{ maxWidth: 480 }}>
      {rows.map((character) => (
        <CharacterRow key={character.id} character={character} isMine={character.id === mine} onOpen={fn()} />
      ))}
    </ul>
  );
}

const meta = { title: 'Componentes/CharacterRow', component: List } satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ComHPeCA: Story = {
  name: 'Com HP e CA',
  args: { rows: [base, another] },
};

export const Mestre: Story = {
  name: 'Sem personagem seu',
  args: { rows: [base, another], mine: '' },
};

export const NomeExtenso: Story = {
  name: 'Nome extenso',
  args: { rows: [{ ...base, name: 'Elara Sombravil, guardiã dos caminhos esquecidos', hp: 148, ac: 21 }] },
};