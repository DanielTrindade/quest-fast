import type { RefObject } from 'react';
import { Plus } from '@phosphor-icons/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitePath } from '@quest-fast/shared';
import { InviteDialog } from '../../components/InviteDialog';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { api } from '../../lib/api';
import { errorMessage } from './campaign-screen';

export function InviteDialogHost({
  campaignId,
  campaignName,
  inviteCode,
  open,
  onOpenChange,
  openerRef,
}: {
  campaignId: string;
  campaignName: string;
  inviteCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openerRef: RefObject<HTMLElement | null>;
}) {
  const queryClient = useQueryClient();
  const rotate = useMutation({
    mutationFn: () => api.rotateInvite(campaignId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          openerRef.current?.focus();
        }}
      >
        <InviteDialog
          link={window.location.origin + invitePath(inviteCode)}
          code={inviteCode}
          campaignName={campaignName}
          onRotate={() => rotate.mutate()}
          rotating={rotate.isPending}
          rotateError={rotate.isError ? errorMessage(rotate.error) : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}

export function InviteButton({ onClick, variant }: { onClick: (opener: HTMLElement) => void; variant?: 'secondary' }) {
  return (
    <Button variant={variant} onClick={(event) => onClick(event.currentTarget)}>
      <Plus size={18} aria-hidden="true" />
      Convidar jogadores
    </Button>
  );
}
