import { createContext } from 'react';

// The lab supplies a target inside each theme. In the app it uses the root.
export const PortalContext = createContext<HTMLElement | undefined>(undefined);
