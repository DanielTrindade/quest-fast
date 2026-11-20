import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import type { ChatMessageView } from '@quest-fast/shared';
import { ChatPanel } from '../components/ChatPanel';
import type { SocketStatus } from '../lib/campaign-socket';
import { AUTHORS, CHAT_MEMBERS, chatMessage, conversation, longConversation, worstNames } from './fixtures/chat';

/**
 * The chat as the screen will own it: the messages, the draft and the reply
 * live here, outside the panel, and a sent message comes back as the server's.
 */
function Live({ initial, state = 'ready', status = 'connected', viewerMaster = false, sendError = null, hasMore = false, height }: {
  initial: ChatMessageView[];
  state?: 'loading' | 'error' | 'ready';
  status?: SocketStatus;
  viewerMaster?: boolean;
  sendError?: string | null;
  hasMore?: boolean;
  /** A fixed box makes the list scroll; without it the list shows whole. */
  height?: number;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessageView | null>(null);
  const viewer = viewerMaster ? AUTHORS.lia : AUTHORS.rafael;

  return (
    <div className="grid gap-3 p-4" style={{ maxWidth: 360 }}>
      <div className="flex rounded-panel border border-border-strong bg-card p-3" style={{ height }}>
        <ChatPanel className="flex-1" messages={messages} viewerId={viewer.userId} viewerMaster={viewerMaster} members={CHAT_MEMBERS}
          state={state} loadError="Não foi possível carregar o chat." onRetry={fn()}
          hasMore={hasMore} onLoadMore={fn()} status={status}
          draft={draft} onDraftChange={setDraft} replyTo={replyTo} onReply={setReplyTo}
          onSend={(body, source) => {
            if (sendError) return;
            setMessages((list) => [...list, chatMessage(viewer, body, replyTo ? { replyTo: { id: replyTo.id, authorName: replyTo.author.name, body: replyTo.body } } : {})]);
            if (source === 'draft') setDraft('');
            setReplyTo(null);
          }}
          sendError={sendError}
          onRemove={(removed) => setMessages((list) => list.map((message) => message.id === removed.id
            ? { ...message, body: null, mentions: [], removed: true }
            : message))} />
      </div>
      <button type="button" className="justify-self-start text-small text-accent-text underline"
        onClick={() => setMessages((list) => [...list, chatMessage(AUTHORS.bruna, 'chegou mensagem nova')])}>
        Chegar mensagem de outra pessoa
      </button>
    </div>
  );
}

/**
 * axe cannot tell the contrast of a line scrolled out of a box that scrolls,
 * so a story that scrolls on purpose lets the box go before the audit.
 */
function unbox(canvasElement: HTMLElement) {
  for (const panel of canvasElement.querySelectorAll<HTMLElement>('[data-slot=chat-panel]')) {
    if (panel.parentElement) panel.parentElement.style.height = 'auto';
  }
}

const meta = {
  title: 'Componentes/ChatPanel',
  component: Live,
  args: { initial: conversation },
} satisfies Meta<typeof Live>;
export default meta;
type Story = StoryObj<typeof meta>;

function firstTheme(canvasElement: HTMLElement) {
  const [region] = within(canvasElement).getAllByRole('region', { name: /^Tema / });
  return within(region!);
}

/** A night at the table: master's badge, a mention of the reader, a reply, an emote and a removed line. */
export const Conversa: Story = {
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    await expect(chat.getAllByText('Mestre').length).toBeGreaterThan(0);
    await expect(chat.getAllByText('Mensagem removida').length).toBeGreaterThan(0);
    const mention = canvasElement.querySelector('[data-mention]');
    await expect(mention).not.toBeNull();
    await expect(chat.getAllByText(/joga com Hazin Dan/).length).toBeGreaterThan(0);
  },
};

export const ListaCheia: Story = {
  name: 'Lista cheia',
  args: { initial: longConversation(10), hasMore: true },
};

export const Vazio: Story = {
  args: { initial: [] },
  play: async ({ canvasElement }) => {
    await expect(firstTheme(canvasElement).getByText('A mesa ainda não falou nada.')).toBeInTheDocument();
  },
};

export const Carregando: Story = { args: { initial: [], state: 'loading' } };

export const ErroAoCarregar: Story = {
  name: 'Erro ao carregar',
  args: { initial: [], state: 'error' },
  play: async ({ canvasElement }) => {
    await expect(firstTheme(canvasElement).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  },
};

export const SemConexao: Story = {
  name: 'Sem conexão',
  args: { status: 'disconnected' },
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    await expect(chat.getByRole('combobox', { name: 'Mensagem para a mesa' })).toBeDisabled();
    await expect(chat.getAllByText('Sem conexão com a mesa').length).toBeGreaterThan(0);
  },
};

export const EnvioRecusado: Story = {
  name: 'Envio recusado',
  args: { sendError: 'Calma: espere um instante antes da próxima mensagem.' },
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    await expect(chat.getByRole('alert')).toHaveTextContent('Calma');
  },
};

export const PiorCasoDeNomes: Story = {
  name: 'Pior caso de nomes',
  args: { initial: worstNames },
};

export const Mestre: Story = {
  name: 'Visto pelo mestre',
  args: { viewerMaster: true },
  play: async ({ canvasElement }) => {
    // The master removes anyone's message; a player only their own.
    await expect(firstTheme(canvasElement).getAllByRole('button', { name: 'Remover a mensagem de Bruna' }).length).toBeGreaterThan(0);
  },
};

/** Enter sends, the line goes to the end and the field empties; Shift+Enter breaks the line. */
export const Enviar: Story = {
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    const field = chat.getByRole('combobox', { name: 'Mensagem para a mesa' });
    await userEvent.type(field, 'primeira linha{Shift>}{Enter}{/Shift}segunda');
    await expect(field).toHaveValue('primeira linha\nsegunda');
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveValue('');
    await expect(chat.getByText(/segunda/)).toBeInTheDocument();
  },
};

/** `@` opens the members; arrows and Enter pick, and the mention goes into the text. */
export const Mencionar: Story = {
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    const field = chat.getByRole('combobox', { name: 'Mensagem para a mesa' });
    await userEvent.type(field, 'valeu @b');
    const list = await chat.findByRole('listbox', { name: 'Membros da campanha' });
    await expect(within(list).getByRole('option', { name: /^Bruna Lyra/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveValue('valeu @Bruna ');
    // "Bruna Clara" still starts with it, yet the pick closed the list.
    await expect(chat.queryByRole('listbox')).toBeNull();
    // Shift+Enter breaks the line even with the list open.
    await userEvent.type(field, '@c');
    await chat.findByRole('listbox');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    await expect(field).toHaveValue('valeu @Bruna @c\n');
    await userEvent.clear(field);
    await userEvent.type(field, 'valeu @b');
    await chat.findByRole('listbox');
    await userEvent.keyboard('{Enter}');
    // The next Enter sends exactly the mention picked.
    await userEvent.keyboard('{Enter}');
    await expect(field).toHaveValue('');
    await expect(chat.getAllByText(/^@Bruna$/).length).toBeGreaterThan(0);
    await userEvent.type(field, '@');
    await chat.findByRole('listbox');
    await userEvent.keyboard('{Escape}');
    await expect(chat.queryByRole('listbox')).toBeNull();
  },
};

/** Reply quotes the line above the field; Esc cancels it. */
export const Responder: Story = {
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    await userEvent.click(chat.getAllByRole('button', { name: 'Responder a Bruna' })[0]!);
    await expect(chat.getByText(/Respondendo a/)).toBeInTheDocument();
    const field = chat.getByRole('combobox', { name: 'Mensagem para a mesa' });
    await userEvent.click(field);
    await userEvent.keyboard('{Escape}');
    await expect(chat.queryByText(/Respondendo a/)).toBeNull();
  },
};

/** The counter shows near the limit and warns at the end; past it, nothing is sent. */
export const Contador: Story = {
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    const field = chat.getByRole('combobox', { name: 'Mensagem para a mesa' });
    await userEvent.click(field);
    await userEvent.paste('a'.repeat(295));
    await expect(chat.getByText('295/300')).toHaveAttribute('data-tone', 'warn');
    await userEvent.paste('b'.repeat(10));
    await expect(chat.getByRole('button', { name: 'Enviar mensagem' })).toBeDisabled();
  },
};

/** Read above the end, a new message shows as a pill instead of pulling the list. */
export const NovasMensagens: Story = {
  name: 'Novas mensagens com a lista rolada',
  args: { initial: longConversation(12), height: 360 },
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-slot=chat-panel] .overflow-y-auto')!;
    // It opens on the latest lines; the reader goes back up.
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0));
    viewport.scrollTop = 0;
    await waitFor(() => expect(viewport.parentElement).toHaveAttribute('data-at-end', 'false'));
    await userEvent.click(chat.getByRole('button', { name: 'Chegar mensagem de outra pessoa' }));
    await expect(await chat.findByRole('button', { name: /1 nova mensagem/ })).toBeInTheDocument();
    // The own message always goes to the end.
    await userEvent.type(chat.getByRole('combobox', { name: 'Mensagem para a mesa' }), 'voltei');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(viewport.scrollTop + viewport.clientHeight).toBeGreaterThanOrEqual(viewport.scrollHeight - 2));
    unbox(canvasElement);
  },
};

/** A line announced to screen readers and then removed leaves the announcement too. */
export const AnuncioRemovido: Story = {
  name: 'Anúncio some com a remoção',
  args: { viewerMaster: true, initial: conversation.slice(0, 3) },
  play: async ({ canvasElement }) => {
    const chat = firstTheme(canvasElement);
    const announcer = canvasElement.querySelector('[data-slot=chat-announcer]')!;
    await userEvent.click(chat.getByRole('button', { name: 'Chegar mensagem de outra pessoa' }));
    await waitFor(() => expect(announcer).toHaveTextContent('Bruna: chegou mensagem nova'));
    const removes = chat.getAllByRole('button', { name: 'Remover a mensagem de Bruna' });
    await userEvent.click(removes.at(-1)!);
    await waitFor(() => expect(announcer).toHaveTextContent(''));
    await expect(canvasElement.textContent).not.toContain('chegou mensagem nova');
  },
};
