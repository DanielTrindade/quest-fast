import { useId, useState } from 'react';
import { whatsAppShareUrl } from '@quest-fast/shared';
import { WhatsappLogo } from '@phosphor-icons/react';
import { CopyField } from './CopyField';
import { RotateArea } from './InviteDialog';
import { Surface } from './Surface';
import { Button as LinkButton } from './ui/button';

/**
 * The code as tiles, one per character, for reading it aloud across the
 * table. The alphabet has no O/0 or I/1 to confuse. Screen readers get the
 * characters spaced out, so they are spelled instead of read as a word.
 */
function CodeTiles({ code }: { code: string }) {
  return (
    <p className="m-0 grid min-w-0 gap-2">
      <span className="text-small text-text-secondary">Ou dite o código</span>
      <span className="sr-only">{code.split('').join(' ')}</span>
      <span aria-hidden="true" className="grid w-full max-w-88 grid-cols-6 gap-1.5">
        {code.split('').map((char, index) => (
          <span key={`${index}-${char}`}
            className="grid aspect-[4/5] min-w-0 place-items-center rounded-control border border-border-strong bg-surface-secret font-mono text-h1 font-semibold text-foreground tabular-nums shadow-[inset_0_-2px_0_var(--color-border-strong)]">
            {char}
          </span>
        ))}
      </span>
    </p>
  );
}

/** The image the server renders for link previews; hidden if it does not load. */
function LinkPreview({ src, campaignName }: { src: string; campaignName: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (failedSrc === src) return null;
  return (
    <figure className="m-0 grid min-w-0 gap-2">
      <figcaption className="text-small text-text-secondary">Como o link aparece no Discord e no WhatsApp</figcaption>
      <img src={src} alt={`Cartão do convite para ${campaignName}`} width={1200} height={630} loading="lazy"
        onError={() => setFailedSrc(src)}
        className="aspect-[1200/630] h-auto w-full rounded-control border border-border bg-surface-secret object-cover" />
    </figure>
  );
}

/**
 * The invite as the subject of the Jogadores screen: the link to copy or
 * send on WhatsApp, the code in tiles to dictate, the card the link unfurls
 * into and, for the master, a new link. Only the master gets it: the server
 * sends the code to no one else.
 */
export function InviteHero({ link, code, campaignName, previewUrl, onRotate, rotating = false, rotateError, copy }: {
  link: string;
  code: string;
  campaignName: string;
  /** The invite's card image; without it the preview is left out. */
  previewUrl?: string;
  onRotate: () => void;
  rotating?: boolean;
  rotateError?: string;
  copy?: (value: string) => Promise<void>;
}) {
  const id = useId();
  return (
    <Surface variant="sheet" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5 max-[479px]:p-4">
      <section aria-labelledby={`${id}-title`} className="contents">
        <div className="grid gap-1">
          <h2 id={`${id}-title`} className="m-0 font-display text-h1 font-semibold text-balance">Reúna sua mesa</h2>
          <p className="m-0 text-text-secondary">Envie o link para quem vai jogar: basta abrir e entrar com o Discord.</p>
        </div>

        <div className="grid min-w-0 gap-3">
          <CopyField value={link} label="Link de convite" spaced={false} copy={copy}
            idleText="Compartilhe este link para convidar alguém."
            copiedText="Link copiado. Compartilhe com sua mesa."
            errorText="Não foi possível copiar. Selecione o link e copie manualmente." />
          <div>
            <LinkButton asChild variant="secondary" className="max-w-full whitespace-normal text-center">
              <a href={whatsAppShareUrl(campaignName, link)} target="_blank" rel="noopener noreferrer">
                <WhatsappLogo size={18} aria-hidden="true" />Compartilhar no WhatsApp<span className="sr-only"> (abre em nova aba)</span>
              </a>
            </LinkButton>
          </div>
        </div>

        <CodeTiles code={code} />

        {previewUrl && <LinkPreview src={previewUrl} campaignName={campaignName} />}

        <RotateArea code={code} onRotate={onRotate} rotating={rotating} rotateError={rotateError} />
      </section>
    </Surface>
  );
}
