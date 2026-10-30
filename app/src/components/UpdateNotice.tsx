import React, { useEffect, useState } from 'react';
import { Button, Card, T } from './ui';
import { useNav } from '../nav/Nav';
import { useTheme } from '../theme/ThemeProvider';
import { useUpdateManager } from '../lib/UpdateProvider';

type UpdateNoticeProps = {
  showWhenUpToDate?: boolean;
};

export function UpdateNotice({ showWhenUpToDate = false }: UpdateNoticeProps) {
  const nav = useNav();
  const { t } = useTheme();
  const { status, progress, enabled, runPrimaryAction, checkUpdates } = useUpdateManager();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 350);
    return () => clearTimeout(timer);
  }, []);

  if (!enabled || (status === 'idle' || status === 'up-to-date') && !showWhenUpToDate) return null;

  const messages: Record<typeof status, { title: string; message: string; button: string; disabled?: boolean }> = {
    idle: { title: 'APP UPDATE', message: 'Check whether an update is available.', button: 'Check for Updates' },
    checking: { title: 'APP UPDATE', message: 'Checking for updates…', button: 'Checking…', disabled: true },
    available: { title: 'UPDATE AVAILABLE', message: 'A compatible update is ready to download.', button: 'Update Available' },
    downloading: {
      title: 'APP UPDATE',
      message: progress === null ? 'Downloading update…' : `Downloading update… ${Math.round(progress * 100)}%`,
      button: progress === null ? 'Downloading update…' : `Downloading… ${Math.round(progress * 100)}%`,
      disabled: true,
    },
    ready: {
      title: 'UPDATE READY',
      message: 'Update downloaded. Flux will restart to apply it.',
      button: nav.hasActiveGame ? 'Apply When You Leave' : 'Restart to Update',
    },
    deferred: { title: 'UPDATE READY', message: 'Flux will restart to apply the update after you leave the game.', button: 'Waiting for Safe Point', disabled: true },
    applying: { title: 'APP UPDATE', message: 'Saving progress before restarting…', button: 'Applying update…', disabled: true },
    'up-to-date': { title: 'APP UPDATE', message: 'No compatible update is available for this build.', button: 'Check Again' },
    'check-error': { title: 'APP UPDATE', message: 'Could not check for updates. Check your connection and try again.', button: 'Retry Check' },
    'download-error': { title: 'APP UPDATE', message: 'The update could not be downloaded. Check your connection and try again.', button: 'Retry Update' },
    'apply-error': { title: 'UPDATE READY', message: 'Flux could not restart. You can try applying the update again.', button: nav.hasActiveGame ? 'Apply When You Leave' : 'Restart to Update' },
  };
  const notice = messages[status];
  const actionDisabled = !settled || notice.disabled;

  return (
    <Card style={{ padding: 12, gap: 8 }}>
      <T v="cap" color={t.accent}>{notice.title}</T>
      <T v="small">{notice.message}</T>
      <Button
        label={notice.button}
        variant="secondary"
        height={44}
        disabled={actionDisabled}
        onPress={() => {
          if (status === 'idle' || status === 'up-to-date') void checkUpdates();
          else void runPrimaryAction();
        }}
      />
    </Card>
  );
}
