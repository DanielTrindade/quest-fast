import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RollSessionEvent } from '@quest-fast/shared';
import { Button } from '../components/Button';
import { FeedFollow } from '../components/FeedFollow';
import { FeedEventCard } from '../components/FeedEventCard';
import '../styles/campaign.css';

const PAGE = 6;

function makeRoll(index: number): RollSessionEvent {
  const minutes = new Date(Date.UTC(2026, 8, 10, 21, 30 + index % 60));
  return {
    id: `e-${index}`,
    campaignId: 'phandalin',
    userId: 'rafael',
    userName: 'Rafael Costa',
    type: 'roll',
    secret: false,
    payload: {
      kind: 'roll',
      expression: '1d20+6',
      dice: [{ value: 1 + ((index * 7) % 20), sides: 20 }],
      modifier: 6,
      total: 7 + ((index * 7) % 20),
      mode: 'normal',
      rollKind: 'skill',
      characterId: 'kaelen',
      characterName: 'Kaelen',
      ability: 'dexterity',
      skill: 'stealth',
    },
    createdAt: minutes.toISOString(),
  };
}

/** `older` events exist before the first page, as a paginated feed would have. */
function Live({ count = 20, older = 0 }: { count?: number; older?: number }) {
  const [oldest, setOldest] = useState(older);
  const [newest, setNewest] = useState(older + count);
  const events = useMemo(
    () => Array.from({ length: newest - oldest }, (_, i) => makeRoll(oldest + i)),
    [oldest, newest],
  );
  return (
    // The page container turns on the desktop height cap, as in the campaign.
    <div className="qf-page">
      <div className="qf-stack" style={{ maxWidth: 420 }}>
        <FeedFollow count={events.length} newestId={events.at(-1)?.id ?? ''} hasMore={oldest > 0}
          onLoadMore={() => setOldest((value) => Math.max(0, value - PAGE))}>
          <ol className="feed-list">
            {events.map((event) => (
              <li key={event.id}><FeedEventCard event={event} /></li>
            ))}
          </ol>
        </FeedFollow>
        <div>
          <Button variant="secondary" onClick={() => setNewest((value) => value + 1)}>
            Chegar novo resultado
          </Button>
        </div>
      </div>
    </div>
  );
}

const meta = { title: 'Componentes/FeedFollow', component: Live, args: { count: 20, older: 0 } } satisfies Meta<typeof Live>;
export default meta;
type Story = StoryObj<typeof meta>;

export const HistoricoCurto: Story = { name: 'Histórico curto', args: { count: 3, older: 0 } };
export const HistoricoLongo: Story = { name: 'Histórico longo', args: { count: 30, older: 12 } };
export const FimDoHistorico: Story = { name: 'Fim do histórico', args: { count: 30, older: 0 } };
