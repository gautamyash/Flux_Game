import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from 'react-native';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';
import { haptic } from '../lib/haptics';
import { getState, useStore } from '../store/store';
import { loginWithGoogle } from '../cloud/flow';
import {
  claimReferralCode,
  fetchUserReferralHistory,
  getOrRegisterUserReferral,
  normalizeReferralCode,
  referralShareMessage,
  ReferralHistoryItem,
  UserReferralData,
} from '../cloud/referral';

export function ReferralScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const mode = useStore((s) => s.mode);
  const account = useStore((s) => s.account);
  const pendingReferralCode = useStore((s) => s.pendingReferralCode);
  const claimedReferralCode = useStore((s) => s.claimedReferralCode);

  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [userData, setUserData] = useState<UserReferralData | null>(null);
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [inputCode, setInputCode] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimMessage, setClaimMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const uid = account?.uid;

  const loadData = async (targetUid?: string) => {
    const activeUid = targetUid || uid;
    if (!activeUid || mode !== 'google') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [data, hist] = await Promise.all([
        getOrRegisterUserReferral(activeUid),
        fetchUserReferralHistory(activeUid),
      ]);
      setUserData(data);
      setHistory(hist);
    } catch {
      // offline safe
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [uid, mode]);

  const handleCopy = () => {
    if (!userData?.code) return;
    Clipboard.setString(userData.code);
    haptic('light');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!userData?.code) return;
    haptic('light');
    try {
      await Share.share({
        message: referralShareMessage(userData.code),
        title: 'FLUX Invite',
      });
    } catch {
      // ignore dismiss
    }
  };

  const handleClaim = async () => {
    if (!inputCode.trim()) return;
    setClaimBusy(true);
    setClaimMessage(null);
    haptic('light');

    if (mode !== 'google' || !uid) {
      setClaimBusy(false);
      const normalized = normalizeReferralCode(inputCode);
      setClaimMessage({
        text: `Invite code ${normalized} saved! Sign in with Google to complete claiming your Reward Chest.`,
        ok: true,
      });
      return;
    }

    const res = await claimReferralCode(uid, inputCode);
    setClaimBusy(false);
    if (res.ok) {
      haptic('success');
      setClaimMessage({
        text: 'Referral code successfully linked! Complete your first level to unlock your Reward Chest.',
        ok: true,
      });
      setInputCode('');
      void loadData(uid);
    } else {
      haptic('error');
      setClaimMessage({ text: res.error, ok: false });
    }
  };

  const handleGoogleSignIn = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    const res = await loginWithGoogle();
    setAuthBusy(false);
    if (res.ok) {
      haptic('success');
      const curAccount = getState().account;
      if (curAccount?.uid) {
        void loadData(curAccount.uid);
      }
    } else if (!res.cancelled) {
      haptic('error');
      setClaimMessage({ text: res.error, ok: false });
    }
  };

  const isAlreadyClaimed = !!claimedReferralCode || !!userData?.invitedByCode;
  const activeCodeDisplay = claimedReferralCode || userData?.invitedByCode;

  return (
    <Screen>
      <TopBar title="Refer & Earn" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <Card style={{ padding: 20, gap: 12, alignItems: 'center' }} bg={t.accentSoft} borderColor={t.accent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="star" size={28} color={t.accent} fill={t.accent} />
            <T v="h2">Invite Friends, Earn Chests</T>
          </View>
          <T v="body" align="center">
            Both you and your friend receive one Reward Chest when they join FLUX and complete their first level!
          </T>
        </Card>

        {/* Guest Mode Banner */}
        {mode !== 'google' ? (
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ gap: 4 }}>
              <T v="title">Sign in with Google to get your code</T>
              <T v="small" color={t.text2}>
                Referral tracking and cloud reward issuance require a verified Google account.
              </T>
            </View>
            {pendingReferralCode ? (
              <Chip tint={t.accent}>Pending invite code: {pendingReferralCode}</Chip>
            ) : null}
            {authBusy ? (
              <ActivityIndicator color={t.accent} style={{ paddingVertical: 8 }} />
            ) : (
              <Button label="Sign in with Google" onPress={() => void handleGoogleSignIn()} />
            )}
          </Card>
        ) : loading ? (
          <Card style={{ padding: 24, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={t.accent} />
          </Card>
        ) : (
          <>
            {/* Referral Code Box */}
            <Card style={{ padding: 18, gap: 14 }}>
              <T v="cap" color={t.text2}>YOUR UNIQUE REFERRAL CODE</T>
              <View
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: t.raised,
                  borderWidth: 1,
                  borderColor: t.grid,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <T v="h1" color={t.accent} style={{ letterSpacing: 2 }}>
                  {userData?.code ?? 'FLUX-......'}
                </T>
                <Pressable
                  onPress={handleCopy}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: copied ? t.success : t.plate,
                  }}
                >
                  <T v="cap" color={copied ? '#FFF' : t.text}>
                    {copied ? 'Copied!' : 'Copy'}
                  </T>
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button label="Share Invite" icon="share" onPress={() => void handleShare()} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="View Rewards"
                    variant="secondary"
                    icon="star"
                    onPress={() => nav.push({ name: 'rewards' })}
                  />
                </View>
              </View>
            </Card>

            {/* Stats Row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Card style={{ flex: 1, padding: 14, alignItems: 'center', gap: 4 }}>
                <T v="h1" color={t.accent}>{userData?.successfulCount ?? 0}</T>
                <T v="cap" color={t.text2} align="center">Completed</T>
              </Card>
              <Card style={{ flex: 1, padding: 14, alignItems: 'center', gap: 4 }}>
                <T v="h1" color={t.text}>{userData?.pendingCount ?? 0}</T>
                <T v="cap" color={t.text2} align="center">Pending</T>
              </Card>
              <Card style={{ flex: 1, padding: 14, alignItems: 'center', gap: 4 }}>
                <T v="h1" color={t.bonus}>{userData?.earnedRewards ?? 0}</T>
                <T v="cap" color={t.text2} align="center">Chests Earned</T>
              </Card>
            </View>
          </>
        )}

        {/* Claim Code Section */}
        <Card style={{ padding: 16, gap: 10 }}>
          <T v="cap" color={t.text2}>HAVE AN INVITE CODE?</T>
          {isAlreadyClaimed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="check" size={18} color={t.success} />
              <T v="body">Linked to code: <T v="title" color={t.accent}>{activeCodeDisplay}</T></T>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={inputCode}
                  onChangeText={(val) => setInputCode(val.toUpperCase())}
                  placeholder="e.g. FLUX-ABC123"
                  placeholderTextColor={t.disabled}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: t.grid,
                    backgroundColor: t.raised,
                    paddingHorizontal: 14,
                    fontFamily: fonts.body,
                    fontSize: 15,
                    color: t.text,
                  }}
                />
                <Button
                  label={claimBusy ? '...' : 'Claim'}
                  variant="primary"
                  height={48}
                  disabled={claimBusy || !inputCode.trim()}
                  onPress={() => void handleClaim()}
                />
              </View>
              {claimMessage ? (
                <T v="small" color={claimMessage.ok ? t.success : t.danger}>
                  {claimMessage.text}
                </T>
              ) : null}
            </View>
          )}
        </Card>

        {/* How It Works Explainer */}
        <Card style={{ padding: 16, gap: 10 }}>
          <T v="cap" color={t.text2}>HOW REFERRALS WORK</T>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Chip tint={t.accent}>1</Chip>
              <T v="small" style={{ flex: 1 }}>
                Share your invite code or APK link with a friend.
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Chip tint={t.accent}>2</Chip>
              <T v="small" style={{ flex: 1 }}>
                Your friend downloads FLUX, enters your code, and signs in with Google.
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Chip tint={t.accent}>3</Chip>
              <T v="small" style={{ flex: 1 }}>
                Once they complete their first puzzle in Chapters or Campaign, both players instantly unlock a Reward Chest!
              </T>
            </View>
          </View>
        </Card>

        {/* Referral Activity / History */}
        {mode === 'google' && history.length > 0 ? (
          <View style={{ gap: 8 }}>
            <T v="cap" color={t.text2}>INVITE ACTIVITY</T>
            {history.map((item) => (
              <Card
                key={item.id}
                style={{
                  padding: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ gap: 2 }}>
                  <T v="title">Player ...{item.invitedUid.slice(-4)}</T>
                  <T v="cap" color={t.text2}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </T>
                </View>
                <Chip tint={item.status === 'completed' ? t.success : t.disabled}>
                  {item.status === 'completed' ? 'Completed · Chest Issued' : 'Pending First Solve'}
                </Chip>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
