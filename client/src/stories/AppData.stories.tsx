import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import type { Role } from '@quest-fast/shared';
import { createAppRouter } from '../router';
import { CAMPAIGN_ID, DATA_STATES, respond, type DataState } from './fixtures/app';

// Both theme frames render the same dataset, so the mock reads one shared value.
const current: { state: DataState; role: Role } = { state: 'demo', role: 'master' };

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
    const reply = respond(current.state, current.role, init?.method ?? 'GET', path);
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

function AppLab({ role, path, data = 'demo' }: { role: Role; path: string; data?: DataState }) {
  return <App key={`${data}-${role}-${path}`} path={path} />;
}

const meta = {
  title: 'Laboratório/Dados extremos',
  component: AppLab,
  parameters: { dataToggle: true },
  // The real screens use fixed ids (`members-title`), so one theme frame at a time.
  globals: { theme: 'dark' },
  beforeEach: installApiMock,
  render: (args, { globals }) => {
    const data: DataState = DATA_STATES.includes(globals.data) ? globals.data : 'demo';
    current.state = data;
    current.role = args.role;
    return <AppLab {...args} data={data} />;
  },
} satisfies Meta<typeof AppLab>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Campanhas: Story = { args: { role: 'master', path: '/campaigns' } };
export const MesaDoMestre: Story = { name: 'Mesa do mestre', args: { role: 'master', path: `/campaigns/${CAMPAIGN_ID}` } };
export const MesaDoJogador: Story = { name: 'Mesa do jogador', args: { role: 'player', path: `/campaigns/${CAMPAIGN_ID}` } };
