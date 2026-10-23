import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CombatSessionEvent, RollSessionEvent, SessionEvent, UnknownSessionEvent } from '@quest-fast/shared';
import { FeedEventCard } from '../components/FeedEventCard';
import '../styles/campaign.css';

const roll: RollSessionEvent = {
  id: 'e1',
  campaignId: 'phandalin',
  userId: 'rafael',
  userName: 'Rafael Costa',
  type: 'roll',
  secret: false,
  payload: {
    kind: 'roll',
    expression: '1d20+6',
    dice: [{ value: 14, sides: 20 }],
    modifier: 6,
    total: 20,
    mode: 'normal',
    rollKind: 'skill',
    characterId: 'kaelen',
    characterName: 'Kaelen',
    ability: 'dexterity',
    skill: 'stealth',
  },
  createdAt: '2026-09-10T21:47:00.000Z',
};

const attack: RollSessionEvent = {
  ...roll,
  id: 'e2',
  payload: {
    ...roll.payload,
    rollKind: 'attack',
    attackName: 'Adaga',
    skill: undefined,
    expression: '1d20+7',
    modifier: 7,
    total: 21,
    dice: [{ value: 14, sides: 20 }],
  },
  createdAt: '2026-09-10T21:48:00.000Z',
};

const secret: RollSessionEvent = { ...roll, id: 'e3', secret: true, createdAt: '2026-09-10T21:49:00.000Z' };

const unknown: UnknownSessionEvent = {
  id: 'e4',
  campaignId: 'phandalin',
  userId: 'lia',
  userName: 'Lia Martins',
  type: 'token.moved',
  secret: false,
  payload: { tokenId: 't1' },
  createdAt: '2026-09-10T21:50:00.000Z',
};

const combatStarted: CombatSessionEvent = {
  id: 'e5',
  campaignId: 'phandalin',
  userId: 'lia',
  userName: 'Lia Martins',
  type: 'combat.started',
  secret: false,
  payload: { kind: 'combat.started', encounterId: 'emboscada', encounterName: 'Emboscada na estrada' },
  createdAt: '2026-09-10T21:51:00.000Z',
};

const combatEnded: CombatSessionEvent = {
  ...combatStarted,
  id: 'e6',
  type: 'combat.ended',
  payload: {
    kind: 'combat.ended',
    encounterId: 'emboscada',
    encounterName: 'Emboscada na estrada',
    rounds: 4,
    defeated: [{ name: 'Goblin 1', hidden: false }, { name: 'Goblin 3', hidden: false }],
  },
  createdAt: '2026-09-10T22:20:00.000Z',
};

function Frame({ event }: { event: SessionEvent }) {
  return (
    <ol className="feed-list" style={{ maxWidth: 420 }}>
      <li><FeedEventCard event={event} /></li>
    </ol>
  );
}

const meta = { title: 'Componentes/FeedEventCard', component: Frame, args: { event: roll } } satisfies Meta<typeof Frame>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pericia: Story = { name: 'Perícia' };
export const Ataque: Story = { args: { event: attack } };
export const Secreta: Story = { args: { event: secret } };
export const CombateIniciado: Story = { name: 'Combate iniciado', args: { event: combatStarted } };
export const CombateEncerrado: Story = { name: 'Combate encerrado', args: { event: combatEnded } };
export const TipoDesconhecido: Story = { name: 'Tipo desconhecido (Fase 2)', args: { event: unknown } };