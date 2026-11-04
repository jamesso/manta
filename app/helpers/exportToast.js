import { toast } from '@/components/ui/toast';

// Show the file name only: a full path is too long for the toast, and the
// action button opens the folder anyway.
export const showExportedToast = (t, filePath) =>
  toast.add({
    type: 'success',
    title: t('preview:drawer:exported'),
    description: filePath.split(/[\\/]/).pop(),
    actionProps: {
      children: t('preview:sidebar:einvoice:reveal'),
      onClick: () => window.manta.ipc.send('reveal-file', filePath),
    },
  });
