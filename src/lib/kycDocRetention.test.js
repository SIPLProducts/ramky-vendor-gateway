import { describe, expect, test } from 'bun:test';
import { keepFirstUploadOnVerifyFail, shouldLiftDocFile, fileForManualSuccess } from './kycDocRetention.ts';

describe('KYC document retention', () => {
  test('first upload, OCR ok + verification fails: document saved, tab not verified', () => {
    expect(keepFirstUploadOnVerifyFail(false)).toBe(true);
    expect(shouldLiftDocFile({ status: 'failed', file: 'new.pdf', ocrPassedFile: 'new.pdf' })).toBe(true);
  });
  test('first upload, OCR fails + manual fails: document not saved', () => {
    expect(shouldLiftDocFile({ status: 'failed' })).toBe(false);
  });
  test('re-upload, OCR ok + verification fails: old document kept', () => {
    expect(keepFirstUploadOnVerifyFail(true)).toBe(false);
    expect(shouldLiftDocFile({ status: 'verified', file: 'old.pdf' })).toBe(true);
  });
  test('manual verification success uses the newly uploaded file', () => {
    expect(fileForManualSuccess('new.pdf', undefined, 'old.pdf')).toBe('new.pdf');
  });
  test('manual verification success with no new file keeps the saved file', () => {
    expect(fileForManualSuccess(null, undefined, 'old.pdf')).toBe('old.pdf');
  });
});
