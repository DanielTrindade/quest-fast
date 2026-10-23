import { collectPdfFields, sheetFromOfficialPdf, type SheetImportResult } from '@quest-fast/shared';

/**
 * Reads the form fields of a filled sheet PDF in the browser and hands them
 * to the shared parser; the file never reaches the server. Resolves to `null`
 * when the PDF is not the official sheet. Rejects when it is not a PDF or
 * when no field could be read at all; fields that fail one by one become a
 * warning in the result instead.
 */
export async function readSheetPdf(file: File): Promise<SheetImportResult | null> {
  // pdf-lib is large and only this action needs it, so it loads on demand.
  const { PDFCheckBox, PDFDocument, PDFTextField } = await import('pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  const { values, unreadable } = collectPdfFields(
    doc.getForm().getFields().map((field) => ({
      name: field.getName(),
      read: () => {
        if (field instanceof PDFTextField) return field.getText() ?? '';
        if (field instanceof PDFCheckBox) return field.isChecked();
        return undefined;
      },
    })),
  );
  if (unreadable.length > 0 && Object.keys(values).length === 0) throw new UnreadableSheetError();
  return sheetFromOfficialPdf(values, unreadable);
}

/** The file is a PDF with a form, but none of its fields could be read. */
export class UnreadableSheetError extends Error {
  constructor() {
    super('No field of the PDF could be read.');
    this.name = 'UnreadableSheetError';
  }
}
