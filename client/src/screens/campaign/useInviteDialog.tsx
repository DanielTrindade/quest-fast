import { useRef, useState } from 'react';
import type { CampaignDetail } from '@quest-fast/shared';
import { InviteButton, InviteDialogHost } from './InviteControls';

/**
 * The master's invite: a button wherever it is useful and the one dialog it
 * opens. Focus returns to whichever button opened it. Nothing for a player.
 */
export function useInviteDialog(campaignId: string, campaign: CampaignDetail | undefined) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const openInvite = (element: HTMLElement) => {
    opener.current = element;
    setOpen(true);
  };
  const inviteCode = campaign?.role === 'master' ? campaign.inviteCode : null;
  return {
    available: Boolean(inviteCode),
    button: inviteCode ? <InviteButton onClick={openInvite} /> : null,
    secondaryButton: inviteCode ? <InviteButton variant="secondary" onClick={openInvite} /> : null,
    dialog: campaign && inviteCode ? (
      <InviteDialogHost
        campaignId={campaignId}
        campaignName={campaign.name}
        inviteCode={inviteCode}
        open={open}
        onOpenChange={setOpen}
        openerRef={opener}
      />
    ) : null,
  };
}
