import { useId } from 'react';
import { CheckCircle, FilePdf, Warning } from '@phosphor-icons/react';
import { cn } from '../lib/utils';
import { fileButton } from './form-styles';

export type SheetImportStatus =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'done'; fileName: string; warnings: string[] }
  | { kind: 'error'; message: string };

/**
 * Picks the official sheet PDF to fill a new character, or a bestiary
 * creature from an NPC written on the same sheet. Presentational: the reading
 * happens in the consumer, which reports back through `status`.
 */
const hint = 'm-0 text-small text-text-secondary';
const statusLine = 'm-0 flex items-start gap-2 text-small [&>svg]:mt-px [&>svg]:flex-none';

export function SheetImport({
  status,
  onPick,
  title = 'Já tem a ficha preenchida?',
  description = 'Importe o PDF da ficha oficial de D&D 2024 em português. Ele substitui o que estiver neste formulário, e nada é salvo antes de você conferir.',
}: {
  status: SheetImportStatus;
  onPick: (file: File) => void;
  title?: string;
  description?: string;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid justify-items-start gap-3 rounded-panel border border-dashed border-border-strong bg-card p-4">
      <div className="grid gap-1">
        <h3 id={titleId} className="m-0 text-body font-semibold">{title}</h3>
        <p className={hint}>{description}</p>
      </div>

      <label className={fileButton} aria-disabled={status.kind === 'reading' || undefined}>
        <FilePdf size={18} aria-hidden="true" />
        {status.kind === 'done' ? 'Importar outro PDF' : 'Importar PDF'}
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={status.kind === 'reading'}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clearing lets the same file be picked again after a fix.
            event.target.value = '';
            if (file) onPick(file);
          }}
        />
      </label>

      <div className="grid gap-2 empty:hidden" aria-live="polite">
        {status.kind === 'reading' && <p className={hint}>Importando ficha…</p>}
        {/* Complete and partial imports read differently: a partial one must
            not look done. Nothing is created yet in either case. */}
        {status.kind === 'done' && (
          <>
            {status.warnings.length === 0 ? (
              <p className={cn(statusLine, 'text-success-text')}>
                <CheckCircle size={18} weight="fill" aria-hidden="true" />
                Ficha importada. Revise os dados antes de criar.
              </p>
            ) : (
              <p className={cn(statusLine, 'font-semibold text-accent-text')}>
                <Warning size={18} weight="fill" aria-hidden="true" />
                Ficha importada com pontos para revisar. Confira os itens abaixo antes de criar.
              </p>
            )}
            <p className={hint}>Arquivo: {status.fileName}</p>
            {status.warnings.length > 0 && (
              <ul aria-label="Pontos para revisar" className="m-0 grid list-none gap-1 p-0 text-small text-text-secondary [&>li]:flex [&>li]:items-start [&>li]:gap-2 [&>li]:[overflow-wrap:anywhere] [&_svg]:mt-px [&_svg]:flex-none">
                {status.warnings.map((warning) => (
                  <li key={warning}>
                    <Warning size={16} aria-hidden="true" />
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
      {status.kind === 'error' && (
        <p role="alert" className="m-0 text-small text-danger-text">
          {status.message}
        </p>
      )}
    </section>
  );
}
