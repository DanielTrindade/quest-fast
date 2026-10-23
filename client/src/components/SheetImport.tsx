import { useId } from 'react';
import { CheckCircle, FilePdf, Warning } from '@phosphor-icons/react';

export type SheetImportStatus =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'done'; fileName: string; warnings: string[] }
  | { kind: 'error'; message: string };

/**
 * Picks the official sheet PDF to fill a new character. Presentational: the
 * reading happens in the consumer, which reports back through `status`.
 */
export function SheetImport({ status, onPick }: { status: SheetImportStatus; onPick: (file: File) => void }) {
  const titleId = useId();
  return (
    <section className="sheet-import" aria-labelledby={titleId}>
      <div className="sheet-import__intro">
        <h3 id={titleId} className="sheet-import__title">Já tem a ficha preenchida?</h3>
        <p className="sheet-import__hint">
          Importe o PDF da ficha oficial de D&amp;D 2024 em português. Ele substitui o que estiver neste
          formulário, e nada é salvo antes de você conferir.
        </p>
      </div>

      <label className="qf-file-button" aria-disabled={status.kind === 'reading' || undefined}>
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

      <div className="sheet-import__status" aria-live="polite">
        {status.kind === 'reading' && <p className="sheet-import__hint">Importando ficha…</p>}
        {/* Complete and partial imports read differently: a partial one must
            not look done. Nothing is created yet in either case. */}
        {status.kind === 'done' && (
          <>
            {status.warnings.length === 0 ? (
              <p className="sheet-import__done">
                <CheckCircle size={18} weight="fill" aria-hidden="true" />
                Ficha importada. Revise os dados antes de criar.
              </p>
            ) : (
              <p className="sheet-import__partial">
                <Warning size={18} weight="fill" aria-hidden="true" />
                Ficha importada com pontos para revisar. Confira os itens abaixo antes de criar.
              </p>
            )}
            <p className="sheet-import__hint">Arquivo: {status.fileName}</p>
            {status.warnings.length > 0 && (
              <ul className="sheet-import__warnings" aria-label="Pontos para revisar">
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
        <p role="alert" className="sheet-import__error">
          {status.message}
        </p>
      )}
    </section>
  );
}
