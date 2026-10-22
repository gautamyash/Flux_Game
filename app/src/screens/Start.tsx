import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { FluxMark } from '../components/Icon';
import { Button, Screen, T } from '../components/ui';
import { CellPreview } from '../components/CellPreview';
import { useNav } from '../nav/Nav';
import { getState, setOnboarded, setProfile } from '../store/store';
import { fonts } from '../theme/tokens';
import { useTheme } from '../theme/ThemeProvider';

export function SplashScreen() {
  const nav = useNav();
  const { t } = useTheme();
  useEffect(() => {
    const id = setTimeout(() => nav.reset({ name: getState().mode === null ? 'login' : getState().onboarded ? 'home' : 'onboarding' }), 1100);
    return () => clearTimeout(id);
  }, [nav]);
  return (
    <Screen style={{ alignItems: 'center', justifyContent: 'center' }}>
      <FluxMark size={96} color={t.accent} hole={t.bg} />
      <T v="display" style={{ marginTop: 16 }}>FLUX</T>
      <T v="small">Draw one path.</T>
    </Screen>
  );
}

export function OnboardingScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const [name, setName] = useState(getState().profile.name);
  const save = () => setProfile({ name: name.trim().slice(0, 16) });
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <CellPreview kind="node" n={1} size={72} t={t} />
          <CellPreview kind="node" n={2} size={72} t={t} />
          <CellPreview kind="node" n={3} size={72} t={t} />
        </View>
        <T v="h1" align="center">Connect 1 to the end in a single path</T>
        <T v="body" align="center">Fill every open cell in one line, visiting the numbers in order. Special cells change the rules as you go.</T>
        <View style={{ alignSelf: 'stretch', gap: 6 }}>
          <T v="cap">YOUR NAME (your progress is saved under it)</T>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Player name"
            placeholderTextColor={t.disabled}
            maxLength={16}
            autoCapitalize="words"
            accessibilityLabel="Player name"
            style={{ height: 52, borderRadius: 16, borderWidth: 1, borderColor: t.grid, backgroundColor: t.raised, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 16, color: t.text }}
          />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Button label="Try a practice puzzle" onPress={() => { save(); nav.replace({ name: 'game', source: { kind: 'practice' } }); }} />
        <Button label="Skip" variant="ghost" onPress={() => { save(); setOnboarded(); nav.reset({ name: 'home' }); }} />
      </View>
    </Screen>
  );
}
