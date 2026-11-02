import {
  confirm,
  alert,
  getCurrent,
  resolveCurrent,
  subscribe,
  _reset,
} from '../dialog.js';

describe('ui/lib/dialog', () => {
  beforeEach(() => {
    _reset();
  });

  it('confirm resolves true after resolveCurrent(true)', async () => {
    const p = confirm({ title: 't', message: 'm' });
    expect(getCurrent().kind).toBe('confirm');
    resolveCurrent(true, getCurrent().id);
    await expect(p).resolves.toBe(true);
  });

  it('confirm resolves false after resolveCurrent(false) and bare resolveCurrent()', async () => {
    let p = confirm({ title: 't', message: 'm' });
    resolveCurrent(false, getCurrent().id);
    await expect(p).resolves.toBe(false);

    p = confirm({ title: 't', message: 'm' });
    resolveCurrent(undefined, getCurrent().id);
    await expect(p).resolves.toBe(false);
  });

  it('alert resolves undefined with kind alert and default type info', async () => {
    const p = alert({ title: 't', message: 'm' });
    expect(getCurrent().kind).toBe('alert');
    expect(getCurrent().type).toBe('info');
    resolveCurrent(undefined, getCurrent().id);
    await expect(p).resolves.toBeUndefined();
  });

  it('queues confirm requests in order', async () => {
    const p1 = confirm({ title: '1', message: 'a' });
    const p2 = confirm({ title: '2', message: 'b' });
    expect(getCurrent().title).toBe('1');
    resolveCurrent(true, getCurrent().id);
    await expect(p1).resolves.toBe(true);
    await Promise.resolve();
    expect(getCurrent().title).toBe('2');
    let p2Done = false;
    p2.then(() => {
      p2Done = true;
    });
    await Promise.resolve();
    expect(p2Done).toBe(false);
    resolveCurrent(false, getCurrent().id);
    await expect(p2).resolves.toBe(false);
    expect(getCurrent()).toBeNull();
  });

  it('subscribe runs on enqueue and resolve; getCurrent returns same object', () => {
    const seen = [];
    const unsub = subscribe(() => seen.push(getCurrent()?.id ?? 'null'));
    const first = getCurrent();
    const second = getCurrent();
    expect(first).toBe(second);
    confirm({ title: 't', message: 'm' });
    expect(seen.length).toBeGreaterThan(0);
    const current = getCurrent();
    resolveCurrent(true, current.id);
    unsub();
  });

  it('ignores resolveCurrent when expectedId does not match current', async () => {
    const p1 = confirm({ title: '1', message: 'a' });
    const p2 = confirm({ title: '2', message: 'b' });
    const idA = 'wrong-id';
    resolveCurrent(true, idA);
    expect(getCurrent().title).toBe('1');
    resolveCurrent(true, getCurrent().id);
    await expect(p1).resolves.toBe(true);
    resolveCurrent(false, getCurrent().id);
    await expect(p2).resolves.toBe(false);
  });

  it('double resolve with same id does not dismiss the next dialog', async () => {
    const p1 = confirm({ title: '1', message: 'a' });
    const id1 = getCurrent().id;
    const p2 = confirm({ title: '2', message: 'b' });
    resolveCurrent(true, id1);
    resolveCurrent(true, id1);
    await expect(p1).resolves.toBe(true);
    expect(getCurrent().title).toBe('2');
    resolveCurrent(false, getCurrent().id);
    await expect(p2).resolves.toBe(false);
  });
});
