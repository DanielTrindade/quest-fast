import { useState, type ReactNode } from 'react';
import { PortalContext } from '../lib/portal-context';

export function PortalScope({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return <div ref={setContainer} className="qf-portal-scope">
    <PortalContext.Provider value={container ?? undefined}>{children}</PortalContext.Provider>
  </div>;
}
