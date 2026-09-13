import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import type { CharacterSummary } from '@quest-fast/shared';
import { CharacterRow } from '../components/CharacterRow';
import '../styles/campaign.css';

const base: CharacterSummary = {
  id: 'hazin',
  name: 'Hazin Dan',
  race: 'Humano',
  class: 'Bárbaro',
  level: 4,
  ownerId: 'daniel',
  ownerName: 'Daniel',
  avatarUrl: '/portraits/elara-example.png',
  hp: 55,
  hpCurrent: 55,
  hpTemp: 0,
  ac: 17,
};

const another: CharacterSummary = {
  ...base,
  id: 'lyra',
  name: 'Lyra Ventoclaro',
  race: 'Anã',
  class: 'Clériga',
  level: 5,
  ownerId: 'ana',
  ownerName: 'Ana Beatriz',
  avatarUrl: null,
  hp: 38,
  hpCurrent: 22,
  hpTemp: 5,
  ac: 18,
};

function List({ rows, mine = 'hazin' }: { rows: CharacterSummary[]; mine?: string }) {
  return (
    <ul className="characters-list" style={{ maxWidth: 520 }}>
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
  name: 'Com PV e CA',
  args: { rows: [base, another] },
};

export const Mestre: Story = {
  name: 'Sem personagem seu',
  args: { rows: [base, another], mine: '' },
};

export const Caido: Story = {
  name: 'Caído',
  args: { rows: [{ ...base, hpCurrent: 0 }, another] },
};

export const NomeExtenso: Story = {
  name: 'Nome extenso',
  args: { rows: [{ ...base, name: 'Hazin Dan, o machado que atravessou as Planícies de Cinza', hp: 148, hpCurrent: 131, hpTemp: 12, ac: 21 }] },
};
