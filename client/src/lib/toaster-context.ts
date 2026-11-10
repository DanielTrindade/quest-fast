import { createContext } from 'react';

// The lab mounts one Toaster per theme frame; a toast goes to the frame that
// raised it. In the app there is a single Toaster and no id.
export const ToasterContext = createContext<string | undefined>(undefined);
