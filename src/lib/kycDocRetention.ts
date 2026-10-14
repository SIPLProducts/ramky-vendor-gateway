/**
 * Decides which GST / PAN / Bank document is kept when OCR or verification fails.
 * Pure helpers so the rules can be unit-tested independently of the UI.
 */

/** First upload (nothing saved yet) whose OCR passed but verification failed keeps its file. */
export function keepFirstUploadOnVerifyFail(hasSavedDoc: boolean): boolean {
  return !hasSavedDoc;
}

export interface RetentionDoc {
  status: string;
  file?: File | unknown;
  ocrPassedFile?: File | unknown;
}

/** Should this tab's file be handed to the draft save? */
export function shouldLiftDocFile(doc: RetentionDoc): boolean {
  if (doc.status === "verified") return !!doc.file;
  return doc.status === "failed" && !!doc.ocrPassedFile;
}

/**
 * File to attach after a successful manual verification: the newly held file
 * wins over the previously saved one, so a re-upload replaces the old document.
 */
export function fileForManualSuccess<T>(held: T | null | undefined, ocrPassed: T | null | undefined, previous: T | null | undefined): T | undefined {
  return held ?? ocrPassed ?? previous ?? undefined;
}
