import { useEffect, useId, useRef, useState } from 'react';
import { whatsAppShareUrl } from '@quest-fast/shared';
import { WhatsappLogo } from '@phosphor-icons/react';
import { Button } from './Button';
import { CopyField } from './CopyField';
import { Button as LinkButton } from './ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

type InviteDialogProps = {
  link: string;
  code: string;
  campaignName: string;
  onRotate: () => void;
  rotating?: boolean;
  rotateError?: string;
};

function RotateArea({ code, onRotate, rotating = false, rotateError }: Pick<InviteDialogProps, 'code' | 'onRotate' | 'rotating' | 'rotateError'>) {
  const [confirming, setConfirming] = useState(false);
  const [seenCode, setSeenCode] = useState(code);
  if (seenCode !== code) {
    setSeenCode(code);
    setConfirming(false);
  }
  const showConfirm = confirming || rotating;
  const promptId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (showConfirm) confirmRef.current?.focus();
    else if (wasConfirming.current) triggerRef.current?.focus();
    wasConfirming.current = showConfirm;
  }, [showConfirm]);
  useEffect(() => {
    if (rotateError) confirmRef.current?.focus();
  }, [rotateError]);
  return <div className="grid gap-3 border-t border-border pt-4">
    {showConfirm
      ? <div className="grid gap-3">
        <p id={promptId} className="text-small text-text-secondary">O link atual vai parar de funcionar</p>
        <div className="flex flex-wrap gap-2">
          <Button ref={confirmRef} variant="danger" aria-describedby={promptId} onClick={onRotate} loading={rotating}>Gerar novo link</Button>
          <Button variant="secondary" onClick={() => setConfirming(false)} disabled={rotating}>Cancelar</Button>
        </div>
      </div>
      : <div><Button ref={triggerRef} variant="ghost" onClick={() => setConfirming(true)}>Gerar novo link</Button></div>}
    {rotateError && <p role="alert" className="text-small text-danger-text">{rotateError}</p>}
  </div>;
}

export function InviteDialog({ link, code, campaignName, onRotate, rotating = false, rotateError }: InviteDialogProps) {
  return <>
    <DialogHeader>
      <DialogTitle>Reúna sua mesa</DialogTitle>
      <DialogDescription>Envie o link para quem vai participar da campanha.</DialogDescription>
    </DialogHeader>
    <div className="grid min-w-0 gap-4">
      <CopyField value={link} label="Link de convite" spaced={false}
        idleText="Compartilhe este link para convidar alguém."
        copiedText="Link copiado. Compartilhe com sua mesa."
        errorText="Não foi possível copiar. Selecione o link e copie manualmente." />
      <LinkButton asChild className="w-full whitespace-normal text-center">
        <a href={whatsAppShareUrl(campaignName, link)} target="_blank" rel="noopener noreferrer">
          <WhatsappLogo size={18} aria-hidden="true" />Compartilhar no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
        </a>
      </LinkButton>
      <p className="text-small text-text-muted">Ou use o código <span className="font-mono font-semibold tracking-[0.16em] [overflow-wrap:anywhere]">{code}</span></p>
      <RotateArea code={code} onRotate={onRotate} rotating={rotating} rotateError={rotateError} />
    </div>
  </>;
}
