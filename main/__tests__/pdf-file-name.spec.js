import { describe, expect, it } from 'vitest';
import path from 'node:path';

import { pdfFileName } from '../pdf-file-name.js';

const dir = '/tmp/export';

describe('pdfFileName', () => {
  it('uses id.pdf for invoices', () => {
    expect(pdfFileName('abc-123', 'invoice', dir)).toBe('abc-123.pdf');
    expect(pdfFileName('abc-123', undefined, dir)).toBe('abc-123.pdf');
  });

  it('prefixes estimates', () => {
    expect(pdfFileName('abc-123', 'estimate', dir)).toBe(
      'estimate-abc-123.pdf'
    );
  });

  it('strips path segments from id', () => {
    expect(pdfFileName('../x', 'invoice', dir)).toBe('x.pdf');
  });

  it('rejects empty and reserved names', () => {
    expect(() => pdfFileName('', 'invoice', dir)).toThrow('invalid-doc-id');
    expect(() => pdfFileName('CON', 'invoice', dir)).toThrow('invalid-doc-id');
  });

  it('stays inside export directory', () => {
    expect(pdfFileName('ok', 'invoice', dir)).toBe('ok.pdf');
    const resolved = path.resolve(dir, pdfFileName('ok', 'invoice', dir));
    expect(resolved.startsWith(path.resolve(dir))).toBe(true);
  });
});
