import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { Role } from '@quest-fast/shared';
import { createAppRouter } from '../router';
import { CAMPAIGN_ID, DATA_STATES, respond, type DataState, type InviteScenario } from './fixtures/app';

// Both theme frames render the same dataset, so the mock reads one shared value.
const current: { state: DataState; role: Role; invite?: InviteScenario; requests: string[] } = {
  state: 'demo',
  role: 'master',
  requests: [],
};

class QuietSocket extends EventTarget {
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    super();
    setTimeout(() => this.onopen?.(), 0);
  }
  send() {}
  close() {}
}

function installApiMock() {
  const realFetch = window.fetch;
  const RealSocket = window.WebSocket;
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const path = url.startsWith('http') ? new URL(url).pathname + new URL(url).search : url;
    if (!path.startsWith('/api/')) return realFetch(input, init);
    const method = init?.method ?? 'GET';
    current.requests.push(`${method} ${path.split('?')[0]}`);
    const reply = respond(current.state, current.role, method, path, current.invite);
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status, headers: { 'content-type': 'application/json' },
    });
  };
  window.WebSocket = QuietSocket as unknown as typeof WebSocket;
  return () => {
    window.fetch = realFetch;
    window.WebSocket = RealSocket;
  };
}

function App({ path }: { path: string }) {
  const [{ router, queryClient }] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
    return { queryClient: client, router: createAppRouter(client, createMemoryHistory({ initialEntries: [path] })) };
  });
  return <QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>;
}

function AppLab({ role, path, data = 'demo' }: { role: Role; path: string; data?: DataState; invite?: InviteScenario }) {
  return <App key={`${data}-${role}-${path}`} path={path} />;
}

const meta = {
  title: 'Laboratório/Dados extremos',
  component: AppLab,
  parameters: { dataToggle: true },
  beforeEach: installApiMock,
  render: (args, { globals }) => {
    const data: DataState = DATA_STATES.includes(globals.data) ? globals.data : 'demo';
    current.state = data;
    current.role = args.role;
    current.invite = args.invite;
    current.requests = [];
    return <AppLab {...args} data={data} />;
  },
} satisfies Meta<typeof AppLab>;
export default meta;
type Story = StoryObj<typeof meta>;

// The real screens use fixed ids (`members-title`): each story renders one theme frame.
const dark = { theme: 'dark' };
const light = { theme: 'light' };
const campaigns = { role: 'master', path: '/campaigns' } as const;
const master = { role: 'master', path: `/campaigns/${CAMPAIGN_ID}` } as const;
const player = { role: 'player', path: `/campaigns/${CAMPAIGN_ID}` } as const;

export const Campanhas: Story = { args: campaigns, globals: dark };
export const CampanhasClaro: Story = { name: 'Campanhas (claro)', args: campaigns, globals: light };
export const MesaDoMestre: Story = { name: 'Mesa do mestre', args: master, globals: dark };
export const MesaDoMestreClaro: Story = { name: 'Mesa do mestre (claro)', args: master, globals: light };
export const MesaDoJogador: Story = { name: 'Mesa do jogador', args: player, globals: dark };
export const MesaDoJogadorClaro: Story = { name: 'Mesa do jogador (claro)', args: player, globals: light };

const JOIN_MARKER_KEY = 'qf_join_after_login';
const INVITE = '/invite/MESA42';
const JOIN_REQUEST = 'POST /api/campaigns/join';
const INVITE_REQUEST = 'GET /api/invites/MESA42';

function withJoinMarker() {
  sessionStorage.setItem(JOIN_MARKER_KEY, 'MESA42');
  return () => sessionStorage.removeItem(JOIN_MARKER_KEY);
}

function withoutJoinMarker() {
  sessionStorage.removeItem(JOIN_MARKER_KEY);
}

const onTheCampaign = (canvasElement: HTMLElement) =>
  waitFor(() => expect(within(canvasElement).getByRole('link', { name: 'Suas campanhas' })).toBeVisible(), { timeout: 5000 });

export const ConviteLogadoComMarca: Story = {
  name: 'Convite: volta do login entra sozinho',
  args: { role: 'player', path: `${INVITE}?join=1`, invite: 'guest' },
  globals: dark,
  beforeEach: withJoinMarker,
  play: async ({ canvasElement }) => {
    await onTheCampaign(canvasElement);
    await expect(current.requests).toContain(JOIN_REQUEST);
  },
};

export const ConviteMembro: Story = {
  name: 'Convite: membro vai direto para a mesa',
  args: { role: 'player', path: INVITE, invite: 'member' },
  globals: dark,
  beforeEach: withoutJoinMarker,
  play: async ({ canvasElement }) => {
    await onTheCampaign(canvasElement);
    await expect(current.requests).not.toContain(JOIN_REQUEST);
  },
};

export const ConviteBloqueado: Story = {
  name: 'Convite: removido é barrado',
  args: { role: 'player', path: `${INVITE}?join=1`, invite: 'blocked' },
  globals: dark,
  beforeEach: withJoinMarker,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Você não pode entrar nesta mesa. Fale com quem te chamou.');
    await expect(canvas.queryByRole('button', { name: 'Entrar na mesa' })).toBeNull();
    await expect(current.requests).not.toContain(JOIN_REQUEST);
  },
};

export const ConviteJoinForjado: Story = {
  name: 'Convite: ?join=1 sem marca não entra',
  args: { role: 'player', path: `${INVITE}?join=1`, invite: 'guest' },
  globals: dark,
  beforeEach: withoutJoinMarker,
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByRole('button', { name: 'Entrar na mesa' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect(current.requests).not.toContain(JOIN_REQUEST);
  },
};

export const ConviteComErro: Story = {
  name: 'Convite: falha do servidor mostra erro e tenta de novo',
  args: { role: 'player', path: INVITE, invite: 'broken' },
  globals: dark,
  beforeEach: withoutJoinMarker,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByText('Não foi possível carregar o convite.');
    const before = current.requests.filter((request) => request === INVITE_REQUEST).length;
    await userEvent.click(canvas.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(current.requests.filter((request) => request === INVITE_REQUEST).length).toBeGreaterThan(before));
    await canvas.findByText('Não foi possível carregar o convite.');
  },
};
