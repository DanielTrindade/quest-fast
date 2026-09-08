import { createContext } from 'react';

// O laboratório fornece um destino dentro de cada tema. No app, usa a raiz.
export const PortalContext = createContext<HTMLElement | undefined>(undefined);
