import React from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { logCrash, lastCrash, reportText } from '../lib/crash';
import { SUPPORT_EMAIL } from '../config';

interface Props { children: React.ReactNode; onRecover?: () => void }
interface S { failed: boolean; key: number }

/**
 * Last line of defence: if any screen throws while rendering, show a calm recovery screen
 * instead of a blank app. Uses plain React Native views only (no theme/store), so it cannot fail itself.
 */
export class ErrorBoundary extends React.Component<Props, S> {
  state: S = { failed: false, key: 0 };

  static getDerivedStateFromError(): Partial<S> {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    void logCrash('render', error);
  }

  private retry = () => {
    this.props.onRecover?.();
    this.setState((s) => ({ failed: false, key: s.key + 1 }));
  };

  private share = () => {
    const c = lastCrash();
    void Share.share({ message: `FLUX crash report (send to ${SUPPORT_EMAIL})\n\n${reportText(c ? [c] : [])}` });
  };

  render() {
    if (!this.state.failed) return <React.Fragment key={this.state.key}>{this.props.children}</React.Fragment>;
    return (
      <View style={{ flex: 1, backgroundColor: '#F6F3EE', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#16161A', textAlign: 'center' }}>Something went wrong</Text>
        <Text style={{ fontSize: 16, color: '#4A4845', textAlign: 'center' }}>
          Your progress is saved. Tap below to get back to the game.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.retry}
          style={{ backgroundColor: '#0B7F7A', paddingHorizontal: 28, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minWidth: 200 }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Back to FLUX</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={this.share} style={{ height: 44, justifyContent: 'center' }}>
          <Text style={{ color: '#0B7F7A', fontSize: 15, fontWeight: '600' }}>Share error report</Text>
        </Pressable>
      </View>
    );
  }
}
