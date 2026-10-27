import React, { useState, useSyncExternalStore } from 'react';
import { Modal, View } from 'react-native';
import { Button, Card, Overlay, Sheet, T } from '../components/ui';
import { useNav } from '../nav/Nav';
import { useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';
import { cloudConfigured } from '../config';
import { deleteAccount, loginWithGoogle, logout } from '../cloud/flow';
import { getSyncStatus, subscribeSync, syncNow } from '../cloud/sync';
import { GUEST_NOTE } from './Login';

function ago(ts: number | null): string {
  if (!ts) return 'not yet';
  const m = Math.round((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
}

export function AccountCard() {
  const nav = useNav();
  const { t } = useTheme();
  const mode = useStore((s) => s.mode);
  const account = useStore((s) => s.account);
  const profileName = useStore((s) => s.profile.name);
  const sync = useSyncExternalStore(subscribeSync, getSyncStatus);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState<null | 'out' | 'delete'>(null);

  const signIn = async () => {
    setBusy(true); setMsg('');
    const r = await loginWithGoogle();
    setBusy(false);
    if (!r.ok && !r.cancelled) setMsg(r.error);
    else if (r.ok) setMsg(r.warning ?? 'Google sign-in complete. Your merged progress is saved to your account.');
  };
  const doSync = async () => {
    setBusy(true); setMsg('');
    const r = await syncNow();
    setBusy(false);
    setMsg(r.ok ? 'Progress merge confirmed and saved to your Google account.' : r.error);
  };
  const doOut = async () => {
    setConfirm(null); setBusy(true);
    const r = await logout();
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    nav.reset({ name: 'login' });
  };
  const doDelete = async () => {
    setConfirm(null); setBusy(true);
    const result = await deleteAccount();
    setBusy(false);
    if (result.ok) nav.reset({ name: 'login' }); else setMsg(result.error);
  };

  const statusText = sync.state === 'syncing' ? 'Syncing…'
    : sync.state === 'offline' ? 'Offline. Will sync when you are back online.'
    : sync.state === 'needs-login' ? 'Please sign in again to keep syncing.'
    : `Synced ${ago(sync.lastAt)}`;

  return (
    <Card style={{ padding: 16, gap: 10 }}>
      <T v="cap">ACCOUNT</T>
      {mode === 'google' && account ? (
        <>
          <T v="title">{profileName || account.name || 'Google account'}</T>
          <T v="small">{account.email}</T>
          <T v="cap" color={sync.state === 'offline' || sync.state === 'needs-login' ? t.danger : t.success}>{statusText}</T>
          <T v="cap">Your progress is saved to this account and follows you to any phone.</T>
          <T v="cap">Energy is saved on this device and does not sync between phones.</T>
          <View style={{ gap: 8 }}>
            {sync.state === 'needs-login' ? <Button label="Sign in again" height={48} onPress={() => void signIn()} disabled={busy} /> : <Button label="Sync now" variant="secondary" height={48} onPress={() => void doSync()} disabled={busy || sync.state === 'syncing'} />}
            <Button label="Sign out" variant="ghost" height={44} onPress={() => setConfirm('out')} disabled={busy} />
            <Button label="Delete my cloud data" variant="ghost" height={44} onPress={() => setConfirm('delete')} disabled={busy} />
          </View>
        </>
      ) : (
        <>
          <T v="title">Guest</T>
          <T v="small">{GUEST_NOTE}</T>
          <Button label="Sign in with Google to save progress and join leaderboards" height={48} onPress={() => void signIn()} disabled={busy} />
          {!cloudConfigured() ? <T v="cap">Google sign-in is not set up in this build yet.</T> : <T v="cap">Your current progress will be added to your account.</T>}
        </>
      )}
      {msg ? <T v="small" color={t.text}>{msg}</T> : null}
      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => setConfirm(null)}>
        {confirm ? (
        <Overlay anchor="center" onDismiss={() => setConfirm(null)}>
          <Sheet>
            <T v="h3">{confirm === 'out' ? 'Sign out?' : 'Delete your cloud data?'}</T>
            <T v="body">
              {confirm === 'out'
                ? 'Your progress stays saved in your Google account. This phone will be cleared; sign in again any time to get it back.'
                : 'This permanently deletes your cloud progress and private leaderboard profile, removes your displayed leaderboard name, then signs you out. Submitted scores remain under a random pseudonym. This cannot be undone.'}
            </T>
            <Button label={confirm === 'out' ? 'Sign out' : 'Delete and sign out'} variant={confirm === 'out' ? 'primary' : 'destructive'} onPress={() => void (confirm === 'out' ? doOut() : doDelete())} />
            <Button label="Cancel" variant="ghost" onPress={() => setConfirm(null)} />
          </Sheet>
        </Overlay>
        ) : null}
      </Modal>
    </Card>
  );
}
