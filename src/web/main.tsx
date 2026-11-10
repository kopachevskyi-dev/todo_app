import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  RouterProvider,
} from '@tanstack/react-router';
import { App } from './App';
import './style.css';

const rootRoute = createRootRoute({
  component: App,
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    task?: string;
    list?: string;
    q?: string;
    week?: string;
    day?: string;
    from?: string;
  } => ({
    from:
      typeof search.from === 'string' &&
      /^\/(backlog|today|history|upcoming)(\?|$)/.test(search.from)
        ? search.from
        : undefined,
    week: typeof search.week === 'string' ? search.week : undefined,
    day: typeof search.day === 'string' ? search.day : undefined,
    q: typeof search.q === 'string' ? search.q : undefined,
    task: typeof search.task === 'string' ? search.task : undefined,
    list: typeof search.list === 'string' ? search.list : undefined,
  }),
});
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/today' });
  },
});
const routes = (
  ['/backlog', '/today', '/history', '/search', '/upcoming'] as const
).map((path) => createRoute({ getParentRoute: () => rootRoute, path }));
const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, ...routes]),
});
const queryClient = new QueryClient();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
