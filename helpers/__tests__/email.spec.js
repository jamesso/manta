import {
  MAILTO_MAX_LENGTH,
  OPEN_EXTERNAL_MAX,
  assertMailtoUrl,
  buildMailto,
  encodeMailtoValue,
  fillTemplate,
  isValidEmail,
  safePdfFileName,
  validateEmailRequest,
} from '../email';

describe('encodeMailtoValue', () => {
  it('encodes reserved characters', () => {
    expect(encodeMailtoValue('a b&c?d#e+f=g')).toBe(
      'a%20b%26c%3Fd%23e%2Bf%3Dg'
    );
  });

  it('normalizes line breaks to CRLF encoding', () => {
    expect(encodeMailtoValue('x\ny')).toBe('x%0D%0Ay');
    expect(encodeMailtoValue('x\r\ny')).toBe('x%0D%0Ay');
    expect(encodeMailtoValue('x\ry')).toBe('x%0D%0Ay');
  });

  it('encodes non-ASCII as UTF-8', () => {
    expect(encodeMailtoValue('Zoë 日本 😀')).toBe(
      'Zo%C3%AB%20%E6%97%A5%E6%9C%AC%20%F0%9F%98%80'
    );
  });
});

describe('buildMailto', () => {
  it('encodes plus in local part', () => {
    const { url } = buildMailto({
      to: 'bill+ietf@example.org',
      subject: 'Hi',
      body: 'Body',
    });
    expect(url).toBe('mailto:bill%2Bietf@example.org?subject=Hi&body=Body');
  });

  it('omits empty subject and body', () => {
    expect(buildMailto({ to: 'user@example.com' }).url).toBe(
      'mailto:user@example.com'
    );
  });

  it('round-trips short draft', () => {
    const { url, truncated } = buildMailto({
      to: 'user@example.com',
      subject: 'Subject',
      body: 'Line one\nLine two',
    });
    expect(truncated).toBe(false);
    const parsed = new URL(url);
    expect(decodeURIComponent(parsed.searchParams.get('subject'))).toBe(
      'Subject'
    );
    expect(decodeURIComponent(parsed.searchParams.get('body'))).toBe(
      'Line one\r\nLine two'
    );
  });

  it('truncates long body', () => {
    const body = 'x'.repeat(5000);
    const { url, truncated } = buildMailto({
      to: 'user@example.com',
      subject: 'S',
      body,
    });
    expect(url.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH);
    expect(truncated).toBe(true);
    expect(() => decodeURIComponent(url.split('body=')[1] ?? '')).not.toThrow();
    const bodyPart = url.match(/body=([^&]*)/)?.[1] ?? '';
    expect(decodeURIComponent(bodyPart).endsWith('…')).toBe(true);
  });

  it('does not split emoji at cut point', () => {
    const body = `${'a'.repeat(1700)}😀${'b'.repeat(2000)}`;
    const { url } = buildMailto({
      to: 'user@example.com',
      subject: 'S',
      body,
    });
    const bodyPart = url.match(/body=([^&]*)/)?.[1] ?? '';
    const decoded = decodeURIComponent(bodyPart);
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(decoded)).toBe(false);
  });

  it('collapses subject line breaks', () => {
    const { url } = buildMailto({
      to: 'user@example.com',
      subject: 'One\nTwo',
      body: '',
    });
    expect(url).toContain('subject=One%20Two');
  });

  it('truncates a 300-character subject at 200 code points with an ellipsis', () => {
    const subject = 'S'.repeat(300);
    const { url, truncated } = buildMailto({
      to: 'user@example.com',
      subject,
      body: '',
    });
    expect(truncated).toBe(true);
    const parsed = decodeURIComponent(
      new URL(url).searchParams.get('subject') ?? ''
    );
    expect(parsed.endsWith('\u2026')).toBe(true);
    expect(Array.from(parsed).length).toBe(201);
  });

  it('prefers a shorter word-boundary body cut when it still fits', () => {
    const short = `${'a'.repeat(20)} `;
    const near = 'b'.repeat(50);
    const body = `${short}${near}${'c'.repeat(3000)}`;
    const { url, truncated } = buildMailto(
      {
        to: 'user@example.com',
        subject: 'S',
        body,
      },
      { maxLength: 130 }
    );
    expect(truncated).toBe(true);
    const decoded = decodeURIComponent(url.match(/body=([^&]*)/)?.[1] ?? '');
    expect(decoded).toBe(`${'a'.repeat(20)}\u2026`);
    expect(decoded.includes('b')).toBe(false);
  });

  it('throws on invalid recipient', () => {
    expect(() => buildMailto({ to: 'bad' })).toThrow('invalid-recipient');
    expect(() => buildMailto({ to: 'a@b.c, d@e.f' })).toThrow(
      'invalid-recipient'
    );
  });
});

describe('assertMailtoUrl', () => {
  it('accepts buildMailto output', () => {
    const { url } = buildMailto({
      to: 'user@example.com',
      subject: 'S',
      body: 'B',
    });
    expect(assertMailtoUrl(url)).toBe(url);
  });

  it('rejects unsafe urls', () => {
    expect(() => assertMailtoUrl('https://x')).toThrow('blocked-url');
    expect(() => assertMailtoUrl('file:///etc/passwd')).toThrow('blocked-url');
    expect(() => assertMailtoUrl('javascript:alert(1)')).toThrow('blocked-url');
    expect(() => assertMailtoUrl(' mailto:a@example.com')).toThrow(
      'blocked-url'
    );
    expect(() => assertMailtoUrl('MAILTO:a@example.com')).toThrow(
      'blocked-url'
    );
    expect(() => assertMailtoUrl('mailto:a@example.com\n')).toThrow(
      'blocked-url'
    );
    expect(() =>
      assertMailtoUrl(
        `mailto:a@example.com?body=${'x'.repeat(OPEN_EXTERNAL_MAX)}`
      )
    ).toThrow('blocked-url');
    expect(() => assertMailtoUrl(null)).toThrow('blocked-url');
  });
});

describe('fillTemplate', () => {
  it('replaces known placeholders once', () => {
    expect(fillTemplate('{a} {b}', { a: '1', b: '{total}', total: '9' })).toBe(
      '1 {total}'
    );
  });

  it('leaves unknown placeholders', () => {
    expect(fillTemplate('{unknown}', {})).toBe('{unknown}');
  });

  it('maps null to empty', () => {
    expect(fillTemplate('{a}', { a: null })).toBe('');
  });
});

describe('safePdfFileName', () => {
  it('sanitizes path characters', () => {
    expect(safePdfFileName('INV/2026:01', 'fb')).toBe('INV-2026-01.pdf');
  });

  it('handles Windows reserved names', () => {
    expect(safePdfFileName('CON', 'fb')).toBe('CON_.pdf');
  });

  it('uses fallback for empty', () => {
    expect(safePdfFileName('...', 'fb')).toBe('fb.pdf');
  });

  it('caps length', () => {
    expect(safePdfFileName('x'.repeat(300), 'fb').length).toBeLessThanOrEqual(
      104
    );
  });
});

describe('validateEmailRequest', () => {
  const base = {
    invoiceId: 'inv1',
    kind: 'invoice',
    invoice: { _id: 'inv1', docType: 'invoice', invoiceID: 'INV-1' },
    draft: { to: 'user@example.com', subject: 'S', body: 'B' },
    fileBase: 'INV-1',
    source: 'app',
    snapshot: { profile: {}, configs: {}, language: 'en' },
  };

  it('normalizes valid request', () => {
    expect(validateEmailRequest(base).invoiceId).toBe('inv1');
  });

  it('ignores legacy source and previewToken fields', () => {
    const out = validateEmailRequest({
      ...base,
      source: 'preview',
      previewToken: 'x',
    });
    expect(out).not.toHaveProperty('source');
    expect(out).not.toHaveProperty('previewToken');
    expect(validateEmailRequest({ ...base, source: undefined }).invoiceId).toBe(
      base.invoiceId
    );
  });

  it('throws on mismatch and bad kind', () => {
    expect(() =>
      validateEmailRequest({ ...base, invoice: { _id: 'other' } })
    ).toThrow('invalid-request');
    expect(() => validateEmailRequest({ ...base, kind: 'estimate' })).toThrow(
      'invalid-request'
    );
    expect(() =>
      validateEmailRequest({ ...base, draft: { ...base.draft, body: 1 } })
    ).toThrow('invalid-request');
  });
});

describe('isValidEmail', () => {
  it('rejects whitespace and list separators', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user@example.com, x@y.z')).toBe(false);
  });
});
