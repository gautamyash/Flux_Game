import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon } from '../components/Icon';
import { Button, Card, Chip, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import { useTheme } from '../theme/ThemeProvider';
import { CompletionRewardRecord, redeemReward, trustedNow, useStore } from '../store/store';
import { rewardDefinition, RewardId, RewardRarity } from '../lib/rewards';
import { haptic } from '../lib/haptics';

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatExpiry(expiresAt: number, now: number): string {
  const diff = Math.max(0, expiresAt - now);
  const hours = Math.floor(diff / (3600 * 1000));
  const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  const secs = Math.floor((diff % (60 * 1000)) / 1000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  if (mins > 0) return `${mins}m ${secs}s left`;
  return `${secs}s left`;
}

function rarityColor(rarity: RewardRarity, fallback: string): string {
  switch (rarity) {
    case 'legendary': return '#F0B642';
    case 'epic': return '#A956E5';
    case 'rare': return '#5EF0C2';
    default: return fallback;
  }
}

export function RewardsScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const completionRewards = useStore((s) => s.completionRewards);
  const referralRewards = useStore((s) => s.referralRewards ?? {});
  const unlockedBoardSkins = useStore((s) => s.unlockedBoardSkins);
  const unlockedProfileBadges = useStore((s) => s.unlockedProfileBadges);
  const [now, setNow] = useState(trustedNow());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(trustedNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const allRewards = [...Object.values(completionRewards), ...Object.values(referralRewards)];

  const activeRewards = allRewards.filter(
    (r) => r.status === 'active' && (r.effectEndsAt === undefined || r.effectEndsAt > now)
  );

  const pendingOrReadyRewards = allRewards.filter((r) => {
    if (r.status === 'redeemed') return true;
    if (r.status === 'pending' && now < r.expiresAt) return true;
    return false;
  });

  const historyRewards = allRewards.filter((r) => {
    if (r.status === 'completed') return true;
    if (r.status === 'expired' || (r.status === 'pending' && now >= r.expiresAt)) return true;
    return false;
  });

  const handleRedeem = (chestId: string) => {
    const res = redeemReward(chestId);
    if (!res.ok) {
      setErrorMsg(res.reason);
      haptic('error');
    } else {
      setErrorMsg(null);
      haptic('success');
    }
  };

  return (
    <Screen>
      <TopBar title="Rewards" onBack={nav.pop} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
        {errorMsg ? (
          <Card style={{ padding: 12, backgroundColor: '#3A1414', borderColor: t.danger }}>
            <T v="small" color={t.danger}>{errorMsg}</T>
          </Card>
        ) : null}

        {/* Section 1: Active Timed Boosts */}
        {activeRewards.length > 0 ? (
          <View style={{ gap: 8 }}>
            <T v="cap" color={t.accent}>ACTIVE POWER-UPS</T>
            {activeRewards.map((reward) => {
              const def = rewardDefinition(reward.rewardId);
              const leftMs = reward.effectEndsAt ? Math.max(0, reward.effectEndsAt - now) : 0;
              return (
                <Card key={reward.chestId} style={{ padding: 16, gap: 8, borderColor: t.accent, borderWidth: 1.5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="bolt" size={18} color={t.accent} />
                      <T v="title">{def.name}</T>
                    </View>
                    <Chip tint={t.accent}>{formatDuration(leftMs)}</Chip>
                  </View>
                  <T v="small" color={t.text2}>{def.description}</T>
                </Card>
              );
            })}
          </View>
        ) : null}

        {/* Section 2: Available / Pending Rewards */}
        <View style={{ gap: 8 }}>
          <T v="cap" color={t.text2}>AVAILABLE REWARDS</T>
          {pendingOrReadyRewards.length === 0 ? (
            <Card style={{ padding: 20, alignItems: 'center', gap: 6 }}>
              <Icon name="star" size={32} color={t.disabled} />
              <T v="title" align="center">No pending rewards</T>
              <T v="small" align="center" color={t.text2}>
                Complete levels for the first time in Chapters or Campaign, or invite friends to earn reward chests.
              </T>
            </Card>
          ) : (
            pendingOrReadyRewards.map((reward) => {
              const def = rewardDefinition(reward.rewardId);
              const isPending = reward.status === 'pending';
              const color = rarityColor(def.rarity, t.text2);
              return (
                <Card key={reward.chestId} style={{ padding: 16, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Chip tint={color}>{def.rarity.toUpperCase()}</Chip>
                      {reward.progression === 'referral' ? <Chip tint={t.accent}>REFERRAL</Chip> : null}
                      <T v="title">{def.name}</T>
                    </View>
                    {isPending ? (
                      <T v="cap" color={t.text2}>Expires in {formatExpiry(reward.expiresAt, now)}</T>
                    ) : (
                      <Chip tint={t.success}>Ready</Chip>
                    )}
                  </View>
                  <T v="small" color={t.text2}>{def.description}</T>
                  {isPending ? (
                    <Button
                      label="Redeem"
                      variant="primary"
                      height={40}
                      onPress={() => handleRedeem(reward.chestId)}
                    />
                  ) : (
                    <Chip tint={t.success}>✓ Redeemed · Charged for next eligible run</Chip>
                  )}
                </Card>
              );
            })
          )}
        </View>

        {/* Section 3: Permanent Cosmetics */}
        <View style={{ gap: 8 }}>
          <T v="cap" color={t.text2}>PERMANENT COSMETICS</T>
          <Card style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <T v="title">Treasure Board Skin</T>
                <T v="cap" color={t.text2}>Gold and royal violet board theme</T>
              </View>
              {unlockedBoardSkins.includes('treasure') ? (
                <Chip tint={t.bonus}>Unlocked</Chip>
              ) : (
                <Chip tint={t.disabled}>Locked · Chest Reward</Chip>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <T v="title">Prism Profile Badge</T>
                <T v="cap" color={t.text2}>Legendary geometric profile prism</T>
              </View>
              {unlockedProfileBadges.includes('prism') ? (
                <Chip tint={t.bonus}>Unlocked</Chip>
              ) : (
                <Chip tint={t.disabled}>Locked · Chest Reward</Chip>
              )}
            </View>
          </Card>
        </View>

        {/* Section 4: History / Expired */}
        {historyRewards.length > 0 ? (
          <View style={{ gap: 8 }}>
            <T v="cap" color={t.text2}>HISTORY</T>
            {historyRewards.map((reward) => {
              const def = rewardDefinition(reward.rewardId);
              const isExpired = reward.status === 'expired' || (reward.status === 'pending' && now >= reward.expiresAt);
              return (
                <Card key={reward.chestId} style={{ padding: 12, opacity: 0.65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <T v="small">{def.name}</T>
                    <T v="cap" color={t.text2}>{def.description}</T>
                  </View>
                  <Chip tint={isExpired ? t.disabled : t.text2}>{isExpired ? 'Expired' : 'Completed'}</Chip>
                </Card>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

