import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FluxMark } from '../components/Icon';
import { Button, Card, Screen, T } from '../components/ui';
import { useNav } from '../nav/Nav';
import { getState } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';
import { continueAsGuest, loginWithGoogle } from '../cloud/flow';

export const GUEST_NOTE = 'Guest: your progress is saved only on this phone. If you uninstall FLUX or change phones, it will be lost.';

export function LoginScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const next = () => nav.reset({ name: getState().onboarded ? 'home' : 'onboarding' });

  const google = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    const r = await loginWithGoogle();
    setBusy(false);
    if (r.ok) next();
    else if (!r.cancelled) setErr(r.error);
  };
  const guest = () => {
    continueAsGuest();
    next();
  };

  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <FluxMark size={84} color={t.accent} hole={t.bg} />
        <T v="display">FLUX</T>
        <T v="body" align="center">Sign in to keep your progress safe and pick it up on any phone.</T>
      </View>
      <View style={{ gap: 10 }}>
        {err ? (
          <Card style={{ padding: 12 }} borderColor={t.danger}>
            <T v="small" color={t.danger}>{err}</T>
          </Card>
        ) : null}
        {busy ? (
          <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel="Signing in">
            <ActivityIndicator color={t.accent} />
          </View>
        ) : (
          <Button label="Continue with Google" onPress={() => void google()} />
        )}
        <T v="cap" align="center">Saves your levels, stars, badges and streak to your Google account.</T>
        <Button label="Continue as Guest" variant="secondary" disabled={busy} onPress={guest} />
        <T v="cap" align="center" color={t.text2}>{GUEST_NOTE}</T>
      </View>
    </Screen>
  );
}
