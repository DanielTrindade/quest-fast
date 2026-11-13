import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { RollSessionEvent } from '@quest-fast/shared';
import { ActionPanel, type ActionPanelSignal, type ActionPanelTab } from '../components/ActionPanel';
import { FeedEventCard } from '../components/FeedEventCard';
import { Field } from '../components/Field';
import { MasterActions } from '../components/MasterActions';
import { PlayerActions } from '../components/PlayerActions';
import { QuickDice } from '../components/QuickDice';
import { TurnBar } from '../components/TurnBar';
import { Button } from '../components/ui/button';
import { hazinDan } from './fixtures/characters';
import { partyMember } from './fixtures/my-characters';
import { PLAYER_ID, playerCombatants } from './fixtures/encounters';
import { masterWithHits } from './fixtures/table';

const roll: RollSessionEvent = {
  id: 'e1', campaignId: 'phandalin', userId: PLAYER_ID, userName: 'Daniel', type: 'roll', secret: false,
  payload: {
    kind: 'roll', expression: '1d20+7', dice: [{ value: 14, sides: 20 }], modifier: 7, total: 21, mode: 'normal',
    rollKind: 'skill', characterId: 'hazin', characterName: 'Hazin Dan', ability: 'strength', skill: 'athletics',
  },
  createdAt: '2026-11-13T21:47:00.000Z',
};

function Dice() {
  const [expression, setExpression] = useState('');
  return (
    <div className="grid gap-3">
      <QuickDice onPick={setExpression} lastExpression={null} />
      <Field label="Expressão" value={expression} onChange={(event) => setExpression(event.target.value)} placeholder="1d20+5" />
    </div>
  );
}

const feed = (
  <ol className="m-0 list-none p-0">
    <li><FeedEventCard event={roll} /></li>
  </ol>
);

const hazinOwn = playerCombatants.find((combatant) => combatant.id === 'c-hazin')!;
const fightActions = { onHitPoints: fn(), onApplyCondition: fn(), onRemoveCondition: fn(), onConcentration: fn(), onAttack: fn(), onApplyDamage: fn(), onDismissReminder: fn(), onToggleHidden: fn() };

function Panel({ role, withFeed = true, signal }: { role: 'player' | 'master'; withFeed?: boolean; signal?: ActionPanelSignal }) {
  const [tab, setTab] = useState<ActionPanelTab>('actions');
  const master = role === 'master';
  return (
    <ActionPanel tab={tab} onTabChange={setTab} actionsSignal={signal}
      header={<TurnBar status="active" round={3} activeName={master ? 'Goblin 1' : 'Hazin Dan'} master={master} ownTurn={!master} onAction={fn()} />}
      actions={master
        ? <MasterActions emptyAction={null} fight={{ name: 'Emboscada na estrada', combatants: masterWithHits, activeCombatantId: 'g1', busyIds: [], actions: fightActions }} />
        : <PlayerActions character={{ ...partyMember({ ...hazinDan, campaignName: 'Mesa de quinta' }), hpCurrent: 38, hpTemp: 5 }} sheet={hazinDan}
          fight={{ combatant: hazinOwn, targets: playerCombatants.filter((combatant) => combatant.id !== 'c-hazin'), active: true, busy: false, actions: fightActions }}
          onRoll={fn()} onOpenSheet={fn()} galleryAction={<Button variant="secondary">Meus personagens</Button>} />}
      dice={<Dice />}
      feed={withFeed ? feed : undefined} />
  );
}

const meta = {
  title: 'Componentes/ActionPanel',
  component: Panel,
  args: { role: 'player', signal: { tone: 'turn', label: 'sua vez' } },
  decorators: [(Story) => <div style={{ maxWidth: 400 }}><Story /></div>],
} satisfies Meta<typeof Panel>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** The player's turn: the bar on top lights up and Ações carries a dot. */
export const JogadorNaVez: Story = {
  name: 'Jogador na vez',
  play: async ({ canvasElement }) => {
    const panel = firstTheme(canvasElement);
    await expect(panel.getByRole('tab', { name: 'Ações (sua vez)' })).toHaveAttribute('aria-selected', 'true');
  },
};

/** A typed expression survives going to Ações and back: the panels stay mounted. */
export const TrocaDeAba: Story = {
  name: 'Troca de aba preserva o que foi digitado',
  play: async ({ canvasElement }) => {
    const panel = firstTheme(canvasElement);
    await userEvent.click(panel.getByRole('tab', { name: 'Dados' }));
    await userEvent.type(panel.getByLabelText('Expressão'), '2d6+3');
    await userEvent.click(panel.getByRole('tab', { name: /^Ações/ }));
    await expect(panel.getByLabelText('Expressão')).not.toBeVisible();
    await userEvent.click(panel.getByRole('tab', { name: 'Dados' }));
    await expect(panel.getByLabelText('Expressão')).toHaveValue('2d6+3');
  },
};

export const MestreComDanoPendente: Story = {
  name: 'Mestre com dano pendente',
  args: { role: 'master', signal: { tone: 'alert', label: '2 danos pendentes', count: 2 } },
};

/** With no map open the feed takes the middle of the table, so its tab is gone. */
export const SemFeed: Story = {
  name: 'Sem a aba Feed',
  args: { withFeed: false },
  play: async ({ canvasElement }) => {
    const panel = firstTheme(canvasElement);
    await expect(panel.queryByRole('tab', { name: 'Feed' })).toBeNull();
  },
};
