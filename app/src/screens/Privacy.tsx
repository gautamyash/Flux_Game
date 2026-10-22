import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Button, Card, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import { PRIVACY_SECTIONS } from '../lib/legal';
import { PRIVACY_URL, SUPPORT_EMAIL } from '../config';

export function PrivacyScreen() {
  const nav = useNav();
  return (
    <Screen>
      <TopBar title="Privacy" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
        {PRIVACY_SECTIONS.map((s) => (
          <Card key={s.title} style={{ padding: 16, gap: 6 }}>
            <T v="h3">{s.title}</T>
            <T v="body">{s.body}</T>
          </Card>
        ))}
        <View style={{ gap: 8 }}>
          {PRIVACY_URL ? <Button label="Open full policy online" variant="secondary" onPress={() => void Linking.openURL(PRIVACY_URL).catch(() => {})} /> : null}
          <Button label="Contact support" variant="ghost" onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=FLUX%20support`).catch(() => {})} />
        </View>
      </ScrollView>
    </Screen>
  );
}
