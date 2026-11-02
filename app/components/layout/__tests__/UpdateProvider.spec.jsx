import React from 'react';
import { render } from '@testing-library/react';
import { UpdateProvider } from '../UpdateProvider';

vi.mock('@/lib/dialog', () => ({
  confirm: vi.fn(() => Promise.resolve(false)),
  alert: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/components/ui/toast', () => ({
  toast: { add: vi.fn() },
}));
vi.mock('../../../../helpers/notify', () => ({
  Notify: vi.fn(),
}));

describe('UpdateProvider', () => {
  beforeEach(() => {
    window.manta.ipc.on.mockClear();
  });

  it('registers update IPC listeners while mounted', () => {
    render(
      <UpdateProvider>
        <div />
      </UpdateProvider>
    );
    expect(window.manta.ipc.on).toHaveBeenCalledWith(
      'update-checking',
      expect.any(Function)
    );
    expect(window.manta.ipc.on).toHaveBeenCalledWith(
      'update-available',
      expect.any(Function)
    );
    expect(window.manta.ipc.on).toHaveBeenCalledWith(
      'update-not-available',
      expect.any(Function)
    );
    expect(window.manta.ipc.on).toHaveBeenCalledWith(
      'update-error',
      expect.any(Function)
    );
    expect(window.manta.ipc.on).toHaveBeenCalledWith(
      'update-download-progress',
      expect.any(Function)
    );
    expect(window.manta.ipc.on).toHaveBeenCalledWith(
      'update-downloaded',
      expect.any(Function)
    );
  });
});
