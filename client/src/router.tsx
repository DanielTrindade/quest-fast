import {
  Outlet,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { safeReturnPath } from '@quest-fast/shared';
import { Toaster } from './components/Toast';
import { ApiError, api } from './lib/api';
import { AccountBar } from './screens/AccountBar';
import { CampaignWorkspace } from './screens/CampaignWorkspace';
import { Campaigns } from './screens/Campaigns';
import { Invite } from './screens/Invite';
import { Login } from './screens/Login';

type RouterContext = { queryClient: QueryClient };

const meQuery = { queryKey: ['me'], queryFn: api.me };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster />
    </>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // Keys are omitted when absent, so navigating to /login does not start
  // requiring `search`.
  validateSearch: (search: Record<string, unknown>): { error?: 'discord'; next?: string } => {
    const next = safeReturnPath(search.next);
    return {
      ...(search.error === 'discord' ? { error: 'discord' as const } : {}),
      ...(next ? { next } : {}),
    };
  },
  component: function LoginScreen() {
    const { error, next } = loginRoute.useSearch();
    return <Login failed={error === 'discord'} next={next} />;
  },
});

const inviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$code',
  validateSearch: (search: Record<string, unknown>): { join?: true; error?: 'discord' } => ({
    ...(search.join === 1 || search.join === '1' || search.join === true ? { join: true as const } : {}),
    ...(search.error === 'discord' ? { error: 'discord' as const } : {}),
  }),
  component: function InviteScreen() {
    const { code } = inviteRoute.useParams();
    const { join, error } = inviteRoute.useSearch();
    return <Invite code={code} join={join === true} failed={error === 'discord'} />;
  },
});

/**
 * Pathless route guarding everything that requires a session. The check is a
 * real API call: the client does not decide on its own whether it is signed in.
 */
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: async ({ context, location }) => {
    try {
      const { user } = await context.queryClient.ensureQueryData(meQuery);
      return { user };
    } catch (error) {
      if (error instanceof ApiError && error.unauthenticated) {
        const next = safeReturnPath(location.href);
        throw redirect({ to: '/login', search: next && !next.startsWith('/login') ? { next } : {} });
      }
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
  inviteRoute,
  authenticatedRoute.addChildren([campaignsRoute, campaignRoute]),
]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    history,
    context: { queryClient },
    defaultPreload: 'intent',
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
