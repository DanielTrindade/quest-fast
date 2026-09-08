import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import './styles/index.css';
import { ErroDaApi } from './lib/api';
import { criarRouter } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Repetir uma requisição sem sessão só adia o redirecionamento ao login.
      retry: (tentativas, erro) => !(erro instanceof ErroDaApi && erro.naoAutenticado) && tentativas < 2,
      refetchOnWindowFocus: false,
    },
  },
});

const router = criarRouter(queryClient);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
