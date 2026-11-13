import type { ReactNode } from 'react';
import { ArrowLeft } from '@phosphor-icons/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { CampaignDetail } from '@quest-fast/shared';
import { Surface } from '../../components/Surface';
import { page } from '../../components/layout-styles';
import { cn } from '../../lib/utils';
import { errorMessage } from './campaign-screen';

const backLink = 'inline-flex min-h-8 items-center gap-1 text-small text-text-secondary no-underline transition-colors duration-(--duration-quick) hover:text-foreground';

/**
 * The frame of a campaign screen: the way back, the heading and the actions.
 * Without a `title` the campaign name is the heading (the overview); with one,
 * the name becomes the line above it.
 */
export function CampaignPage({ campaign, title, actions, children }: {
  campaign: UseQueryResult<CampaignDetail>;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  if (campaign.isError) {
    return (
      <main data-slot="page" className={cn(page, 'mx-auto w-full max-w-[1400px]')}>
        <Link to="/campaigns" className={backLink}>
          <ArrowLeft size={16} aria-hidden="true" /> Suas campanhas
        </Link>
        <Surface>
          <p role="alert" className="text-body text-danger-text">
            {errorMessage(campaign.error)}
          </p>
        </Surface>
      </main>
    );
  }

  const name = campaign.data?.name ?? 'Carregando…';
  return (
    <main data-slot="page" className={cn(page, 'mx-auto w-full max-w-[1400px]')}>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-6 max-[479px]:gap-4 [&_h1]:mt-2 [&_h1]:font-display [&_h1]:text-display [&_h1]:font-semibold [&_h1]:tracking-[-0.04em] @max-[480px]:[&_h1]:text-h1">
        <div className="min-w-0">
          <Link to="/campaigns" className={backLink}>
            <ArrowLeft size={16} aria-hidden="true" />
            Suas campanhas
          </Link>
          {title ? (
            <>
              <p className="mt-2 text-small text-text-muted">{name}</p>
              <h1>{title}</h1>
            </>
          ) : (
            <>
              <h1>{name}</h1>
              {campaign.data?.description && <p className="mt-2 text-text-secondary">{campaign.data.description}</p>}
            </>
          )}
        </div>
        {actions}
      </header>
      {children}
    </main>
  );
}
