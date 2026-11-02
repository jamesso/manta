import { describe, it, expect } from 'vitest';
import { createSingleFlight } from '../singleFlight';

describe('createSingleFlight', () => {
  it('runs fn once for concurrent calls', async () => {
    let n = 0;
    const fn = async () => {
      n += 1;
      await new Promise(r => setTimeout(r, 20));
      return n;
    };
    const run = createSingleFlight(fn);
    const [a, b] = await Promise.all([run(), run()]);
    expect(n).toBe(1);
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('runs again after settle', async () => {
    let n = 0;
    const run = createSingleFlight(async () => {
      n += 1;
      return n;
    });
    expect(await run()).toBe(1);
    expect(await run()).toBe(2);
  });

  it('clears lock on rejection', async () => {
    let n = 0;
    const run = createSingleFlight(async () => {
      n += 1;
      if (n === 1) {
        throw new Error('fail');
      }
      return 'ok';
    });
    await expect(run()).rejects.toThrow('fail');
    await expect(run()).resolves.toBe('ok');
  });
});
