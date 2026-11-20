import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { ActionPanel, type ActionPanelTab } from '../components/ActionPanel';
import { ChatPanel } from '../components/ChatPanel';
import { ChatToasts } from '../components/ChatToasts';
import { PanelRail } from '../components/PanelRail';
import { TokenList } from '../components/TokenList';
import { TurnBar } from '../components/TurnBar';
import { AUTHORS, CHAT_MEMBERS, VIEWER_ID, chatMessage, conversation } from './fixtures/chat';
import { MASTER_ID, PLAYER_ID, masterTokens, playerTokens } from './fixtures/tokens';

const arriving = [
  chatMessage(AUTHORS.bruna, 'alguém viu o goblin fugir pela porta?'),
  chatMessage(AUTHORS.caio, '@Rafael tua vez 👀'),
  chatMessage(AUTHORS.lia, 'Rolem Percepção quando chegarem na ponte.'),
];

/**
 * The full screen's stage as the Mesa composes it: the map, and beside it the
 * same table panel with Mapa first (the column of the stage), icons only;
 * folded, a rail of icons and the new chat lines over the map.
 */
function Stage({ role, folded: startFolded = false, toasts = 0, width = 1100 }: {
  role: 'master' | 'player'; folded?: boolean; toasts?: number; width?: number;
}) {
  const master = role === 'master';
  const [tab, setTab] = useState<ActionPanelTab>('map');
  const [folded, setFolded] = useState(startFolded);
  const [draft, setDraft] = useState('');
  const open = (next?: ActionPanelTab) => {
    if (next) setTab(next);
    setFolded(false);
  };

  return (
    <div className="@container/stage" style={{ maxWidth: width }}>
      <div className="grid h-[600px] min-w-0 grid-rows-[minmax(0,1fr)_auto] gap-3 rounded-panel bg-background p-3 @min-[47.5rem]/stage:grid-cols-[minmax(0,1fr)_auto] @min-[47.5rem]/stage:grid-rows-[minmax(0,1fr)]">
        <div className="relative min-h-0 min-w-0">
          <div className="size-full rounded-panel border border-border bg-surface-secret" role="img" aria-label="Mapa da cena" />
          {folded && (
            <ChatToasts className="absolute bottom-12 left-2 z-10" onOpen={() => open('chat')}
              toasts={arriving.slice(0, toasts).map((message) => ({ message, leaving: false }))} />
          )}
        </div>
        <div className={folded ? 'flex min-w-0 @min-[47.5rem]/stage:min-h-0' : 'flex h-[46dvh] min-h-0 min-w-0 flex-col @min-[47.5rem]/stage:h-auto @min-[47.5rem]/stage:w-[21rem]'}>
          {folded && (
            <PanelRail tabs={['map', 'actions', 'dice', 'feed', 'chat']} onOpen={open}
              actionsSignal={master ? { tone: 'alert', count: 1, label: '1 dano pendente' } : { tone: 'turn', label: 'sua vez' }}
              chatUnread={toasts > 0 ? { count: toasts, mention: toasts > 1 } : null}
              className="flex-row @min-[47.5rem]/stage:h-full @min-[47.5rem]/stage:flex-col" />
          )}
          <ActionPanel className={folded ? 'hidden' : 'h-full min-h-0'} fill compact tab={tab} onTabChange={setTab}
            onCollapse={() => setFolded(true)}
            header={<TurnBar status="active" round={2} activeName={master ? 'Goblin 1' : 'Hazin Dan'} master={master} ownTurn={!master} onAction={fn()} />}
            map={<TokenList tokens={master ? masterTokens() : playerTokens()} viewerId={master ? MASTER_ID : PLAYER_ID} master={master}
              selectedId={null} onSelect={fn()} onStep={fn()} busyIds={new Set()} />}
            actions={<p className="m-0 text-small text-text-secondary">Ações do {master ? 'mestre' : 'jogador'}.</p>}
            dice={<p className="m-0 text-small text-text-secondary">Rolagem livre.</p>}
            feed={<p className="m-0 text-small text-text-secondary">Feed da sessão.</p>}
            chat={<ChatPanel messages={conversation.slice(0, 2)} viewerId={VIEWER_ID} viewerMaster={master} members={CHAT_MEMBERS}
              state="ready" onRetry={fn()} hasMore={false} onLoadMore={fn()} status="connected" draft={draft} onDraftChange={setDraft}
              replyTo={null} onReply={fn()} onSend={fn()} onRemove={fn()} />} />
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: 'Componentes/Painel da tela cheia',
  component: Stage,
  args: { role: 'master' },
} satisfies Meta<typeof Stage>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** The master's panel on the full screen: Mapa first, with the stage's column, and the other tabs as icons. */
export const MestreAberto: Story = {
  name: 'Mestre, painel aberto na aba Mapa',
  play: async ({ canvasElement }) => {
    const stage = firstTheme(canvasElement);
    await expect(stage.getByRole('tab', { name: 'Mapa' })).toHaveAttribute('aria-selected', 'true');
    await expect(stage.getByRole('heading', { name: /Tokens/ })).toBeInTheDocument();
    for (const name of ['Ações', 'Dados', 'Feed', 'Chat']) await expect(stage.getByRole('tab', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
  },
};

export const JogadorAberto: Story = {
  name: 'Jogador, painel aberto na aba Mapa',
  args: { role: 'player' },
};

/** Folding leaves a rail of icons; one of them opens the panel on its tab. */
export const Recolher: Story = {
  name: 'Recolher e expandir pelo trilho',
  play: async ({ canvasElement }) => {
    const stage = firstTheme(canvasElement);
    await userEvent.click(stage.getByRole('button', { name: 'Recolher painel' }));
    const rail = stage.getByRole('navigation', { name: 'Painel da mesa recolhido' });
    await expect(within(rail).getByRole('button', { name: 'Ações (1 dano pendente)' })).toBeInTheDocument();
    await userEvent.click(within(rail).getByRole('button', { name: 'Dados' }));
    await waitFor(() => expect(stage.getByRole('tab', { name: 'Dados' })).toHaveAttribute('aria-selected', 'true'));
  },
};

/** Folded, new chat lines show over the map, the oldest fading; clicking one opens the chat. */
export const RecolhidoComMensagens: Story = {
  name: 'Recolhido, com mensagens sobre o mapa',
  args: { role: 'player', folded: true, toasts: 3 },
  play: async ({ canvasElement }) => {
    const stage = firstTheme(canvasElement);
    const rail = stage.getByRole('navigation', { name: 'Painel da mesa recolhido' });
    await expect(within(rail).getByRole('button', { name: 'Chat (3 mensagens novas, com menção a você)' })).toBeInTheDocument();
    const toasts = canvasElement.querySelector('[data-slot=chat-toasts]')!;
    await expect(toasts).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(within(toasts as HTMLElement).getByText('Abrir o chat'));
    await waitFor(() => expect(stage.getByRole('tab', { name: 'Chat' })).toHaveAttribute('aria-selected', 'true'));
    // Back to Mapa before the audit: the short chat box scrolls, and axe cannot
    // measure lines scrolled out of a box.
    await userEvent.click(stage.getByRole('tab', { name: 'Mapa' }));
  },
};

/** On a phone the panel goes under the map, and folded it is a bar. */
export const CelularRecolhido: Story = {
  name: 'Celular, trilho em barra',
  args: { role: 'player', folded: true, toasts: 1, width: 390 },
};
