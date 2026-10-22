import { sheetFromOfficialPdf, type PdfFieldValues, type SheetImportResult } from '@quest-fast/shared';

/**
 * Reads the form fields of a filled sheet PDF in the browser and hands them
 * to the shared parser; the file never reaches the server. Resolves to `null`
 * when the PDF is not the official sheet and rejects when it is not a PDF.
 */
export async function readSheetPdf(file: File): Promise<SheetImportResult | null> {
  // pdf-lib is large and only this action needs it, so it loads on demand.
  const { PDFCheckBox, PDFDocument, PDFTextField } = await import('pdf-lib');
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
  const fields: PdfFieldValues = {};
  for (const field of doc.getForm().getFields()) {
    try {
      if (field instanceof PDFTextField) fields[field.getName()] = field.getText() ?? '';
      else if (field instanceof PDFCheckBox) fields[field.getName()] = field.isChecked();
    } catch {
      // A field pdf-lib cannot read (rich text, for one) is left out like an empty one.
    }
  }
  return sheetFromOfficialPdf(fields);
}
