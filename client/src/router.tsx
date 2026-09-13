import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { ToastProvider } from './components/Toast';
import { ApiError, api } from './lib/api';
import { AccountBar } from './screens/AccountBar';
import { CampaignWorkspace } from './screens/CampaignWorkspace';
import { Campaigns } from './screens/Campaigns';
import { Login } from './screens/Login';

type RouterContext = { queryClient: QueryClient };

const meQuery = { queryKey: ['me'], queryFn: api.me };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <ToastProvider>
      <Outlet />
    </ToastProvider>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // The key is omitted when there is no error, so navigating to /login does
  // not start requiring `search`.
  validateSearch: (search: Record<string, unknown>): { error?: 'discord' } =>
    search.error === 'discord' ? { error: 'discord' } : {},
  component: function LoginScreen() {
    return <Login failed={loginRoute.useSearch().error === 'discord'} />;
  },
});

/**
 * Pathless route guarding everything that requires a session. The check is a
 * real API call: the client does not decide on its own whether it is signed in.
 */
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: async ({ context }) => {
    try {
      const { user } = await context.queryClient.ensureQueryData(meQuery);
      return { user };
    } catch (error) {
      if (error instanceof ApiError && error.unauthenticated) throw redirect({ to: '/login' });
      throw error;
    }
  },
  component: function Authenticated() {
    return (
      <div className="min-h-dvh bg-surface text-text-primary">
        <Outlet />
      </div>
    );
  },
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/campaigns' });
  },
});

const campaignsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/campaigns',
  component: function CampaignListScreen() {
    const { user } = authenticatedRoute.useRouteContext();
    return <><AccountBar name={user.name} avatarUrl={user.avatarUrl} /><Campaigns /></>;
  },
});

const campaignRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/campaigns/$campaignId',
  component: function CampaignScreen() {
    const { user } = authenticatedRoute.useRouteContext();
    const { campaignId } = campaignRoute.useParams();
    return <CampaignWorkspace key={campaignId} campaignId={campaignId} user={user} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  authenticatedRoute.addChildren([campaignsRoute, campaignRoute]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
