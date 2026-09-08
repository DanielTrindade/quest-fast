import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { ToastProvider } from './components/Toast';
import { ErroDaApi, api } from './lib/api';
import { BarraDaConta } from './telas/BarraDaConta';
import { Campanha } from './telas/Campanha';
import { Campanhas } from './telas/Campanhas';
import { Entrar } from './telas/Entrar';

type ContextoDoRouter = { queryClient: QueryClient };

const consultaMe = { queryKey: ['me'], queryFn: api.me };

const rootRoute = createRootRouteWithContext<ContextoDoRouter>()({
  component: () => (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  ),
});

const entrarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  // A chave é omitida quando não há erro, para que navegar até /entrar não
  // passe a exigir `search`.
  validateSearch: (busca: Record<string, unknown>): { erro?: 'discord' } =>
    busca.erro === 'discord' ? { erro: 'discord' } : {},
  component: function TelaDeEntrada() {
    return <Entrar falhou={entrarRoute.useSearch().erro === 'discord'} />;
  },
});

/**
 * Rota sem caminho que guarda tudo que exige sessão. A verificação é uma
 * chamada real à API: o cliente não decide sozinho se está autenticado.
 */
const autenticadoRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'autenticado',
  beforeLoad: async ({ context }) => {
    try {
      const { usuario } = await context.queryClient.ensureQueryData(consultaMe);
      return { usuario };
    } catch (erro) {
      if (erro instanceof ErroDaApi && erro.naoAutenticado) throw redirect({ to: '/entrar' });
      throw erro;
    }
  },
  component: function Autenticado() {
    const { usuario } = autenticadoRoute.useRouteContext();
    return (
      <div className="min-h-dvh bg-surface text-text-primary">
        <BarraDaConta nome={usuario.nome} avatarUrl={usuario.avatarUrl} />
        <Outlet />
      </div>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/campanhas' });
  },
});

const campanhasRoute = createRoute({
  getParentRoute: () => autenticadoRoute,
  path: '/campanhas',
  component: Campanhas,
});

const campanhaRoute = createRoute({
  getParentRoute: () => autenticadoRoute,
  path: '/campanhas/$campanhaId',
  component: function TelaDaCampanha() {
    return <Campanha campanhaId={campanhaRoute.useParams().campanhaId} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  entrarRoute,
  autenticadoRoute.addChildren([campanhasRoute, campanhaRoute]),
]);

export function criarRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof criarRouter>;
  }
}
