import React, { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { Level, GameState, failTitle, parSeconds } from '../../engine';
import { Board } from '../../components/Board';
import { CellPreview } from '../../components/CellPreview';
import { StarShape } from '../../components/Icon';
import { Button, Chip, Overlay, Sheet, T, fmtTime } from '../../components/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { AchievementDef, achievementById } from '../../lib/achievements';
import { Badge } from '../../components/Badge';
import { CAMPAIGN_WORLDS, CHAPTERS } from '../../lib/levels';
import { ResultData, MAX_HINTS } from './useGame';
import type { SubmissionResult } from '../../cloud/leaderboards';
import { UpdateNotice } from '../../components/UpdateNotice';
import { RewardChest } from '../../components/RewardChest';
import { CompletionRewardRecord, redeemReward, trustedNow, useStore } from '../../store/store';
import { rewardDefinition } from '../../lib/rewards';
import { haptic } from '../../lib/haptics';

export function ResultRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <T v="small">{label}</T>
      <T v="small" color={good ? t.success : t.text}>{value}</T>
    </View>
  );
}

function expiryTimeLeft(expiresAt: number, now: number): string {
  const diff = Math.max(0, expiresAt - now);
  const hours = Math.floor(diff / (3600 * 1000));
  const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
  const secs = Math.floor((diff % (60 * 1000)) / 1000);
  if (hours > 0) return `${hours}h ${mins}m left`;
  if (mins > 0) return `${mins}m ${secs}s left`;
  return `${secs}s left`;
}

function RewardRevealCard({ reward }: { reward: CompletionRewardRecord }) {
  const { t } = useTheme();
  const def = rewardDefinition(reward.rewardId);
  const live = useStore((s) => s.completionRewards[`${reward.progression}:${reward.levelId}`]) ?? reward;
  const [now, setNow] = useState(trustedNow());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(trustedNow()), 1000);
    return () => clearInterval(id);
  }, []);

  const rarityColor = def.rarity === 'legendary' ? '#F0B642'
    : def.rarity === 'epic' ? '#A956E5'
    : def.rarity === 'rare' ? '#5EF0C2'
    : t.text2;

  const isExpired = live.status === 'expired' || (live.status === 'pending' && now >= live.expiresAt);
  const isPending = live.status === 'pending' && !isExpired;
  const isRedeemed = live.status === 'redeemed';
  const isActive = live.status === 'active';
  const isCompleted = live.status === 'completed';

  const onRedeem = () => {
    if (isExpired) {
      setError('This reward has expired and can no longer be redeemed.');
      haptic('error');
      return;
    }
    const res = redeemReward(live.chestId);
    if (!res.ok) {
      setError(res.reason);
      haptic('error');
    } else {
      setError(null);
      haptic('success');
    }
  };

  return (
    <View style={{ gap: 8, alignItems: 'center', width: '100%', paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Chip tint={rarityColor}>{def.rarity.toUpperCase()}</Chip>
        {isPending ? (
          <T v="cap" color={t.text2}>Expires in {expiryTimeLeft(live.expiresAt, now)}</T>
        ) : isExpired ? (
          <T v="cap" color={t.danger}>Expired</T>
        ) : null}
      </View>
      <T v="title" align="center">{def.name}</T>
      <T v="small" align="center" color={t.text2}>{def.description}</T>
      {error ? <T v="cap" color={t.danger} align="center">{error}</T> : null}
      {isPending ? (
        <Button label="Redeem" variant="primary" height={40} onPress={onRedeem} style={{ width: '100%', marginTop: 4 }} />
      ) : isRedeemed ? (
        <Chip tint={t.success}>✓ Redeemed · Ready for next run</Chip>
      ) : isActive ? (
        <Chip tint={t.accent}>✓ Active · Power-up running</Chip>
      ) : isCompleted ? (
        <Chip tint={t.success}>✓ Added to inventory</Chip>
      ) : isExpired ? (
        <Chip tint={t.disabled}>Reward expired</Chip>
      ) : null}
    </View>
  );
}

export function ResultView({ level, state, data, kind, leaderboardSubmission, onRetryLeaderboard, onNext, onRetry, onHome }: {
  level: Level; state: GameState; data: ResultData; kind: string;
  leaderboardSubmission: SubmissionResult | 'pending' | null; onRetryLeaderboard: () => void;
  onNext: () => void; onRetry: () => void; onHome: () => void;
}) {
  const { t, board } = useTheme();
  const ch = data.outcome?.chapterCompleted ?? null;
  const unlockedWorld = CAMPAIGN_WORLDS.find((world) => world.name === data.campaignWorldUnlocked);
  const resultTitle = kind === 'campaign' && data.campaignComplete ? 'Campaign complete!'
    : unlockedWorld ? 'World unlocked!'
    : ch ? `Chapter ${ch} complete`
    : data.outcome?.newBest ? 'New best!' : 'Solved';
  const share = () => {
    void Share.share({ message: `I solved ${level.id === 'daily' || kind === 'daily' ? 'today’s FLUX daily' : 'FLUX ' + level.id} in ${data.moves} moves ${'★'.repeat(data.stars)}` });
  };
  return (
    <Overlay anchor="center">
      <Sheet style={{ alignItems: 'center' }}>
        <T v="h2" color={data.campaignComplete ? CAMPAIGN_WORLDS[49].palette.accent : unlockedWorld?.palette.accent}>{resultTitle}</T>
        {level.boss ? <T v="body" align="center" color={t.bonus}>{data.outcome?.firstSolve
          ? level.boss.campaignWorld ? `World ${level.boss.campaignWorld} Boss defeated. Your best stars are saved once.` : `Chapter ${level.chapter} Boss defeated. Your best stars are saved once.`
          : 'Boss replay complete. Your best stars are kept.'}</T> : null}
        {unlockedWorld ? <T v="body" align="center" color={unlockedWorld.palette.accent}>{unlockedWorld.name} is now open. Complete its five levels to challenge its Boss.</T> : null}
        {kind === 'campaign' && data.campaignComplete ? <T v="body" align="center" color={CAMPAIGN_WORLDS[49].palette.accent}>You completed all 250 levels and 50 World Bosses, reaching {CAMPAIGN_WORLDS[49].name}. Your campaign progress is saved.</T> : null}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[1, 2, 3].map((i) => <StarShape key={i} size={36} filled={i <= data.stars} color={t.bonus} empty={t.grid} />)}
        </View>
        <Board level={level} state={state} size={120} t={board} preview />
        {data.outcome?.completionRewarded && data.outcome.completionReward ? (
          <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 8 }}>
            <T v="cap" color={t.bonus}>FIRST COMPLETION REWARD</T>
            <T v="small" align="center" color={t.text2}>Your personal chest is saved to this player and level.</T>
            <RewardChest style={{ maxWidth: 280 }} rewardContent={<RewardRevealCard reward={data.outcome.completionReward} />} />
          </View>
        ) : null}
        <View style={{ alignSelf: 'stretch' }}>
          <ResultRow label="Time" value={`${fmtTime(data.time)} / ${fmtTime(parSeconds(level))} target`} good={data.time <= parSeconds(level)} />
          <ResultRow label="Hints" value={data.hints === 0 ? 'None' : String(data.hints)} good={data.hints === 0} />
          <ResultRow label="Moves" value={`${data.moves} / ${level.optimal} optimal`} good={data.moves <= level.optimal} />
          {data.bonus ? <ResultRow label="Bonus star" value="Collected" good /> : null}
          {data.streak ? <ResultRow label="Daily streak" value={`${data.streak} day${data.streak === 1 ? '' : 's'}`} good /> : null}
        </View>
        {(kind === 'classic' || kind === 'master' || kind === 'campaign' || kind === 'daily') && leaderboardSubmission ? (
          <View style={{ alignSelf: 'stretch', alignItems: 'center', gap: 8 }}>
            <T v="small" align="center">
              {leaderboardSubmission === 'pending' ? 'Submitting your score…'
                : leaderboardSubmission === 'submitted' ? kind === 'campaign' ? 'Score submitted to the Campaign leaderboard.' : 'Score submitted to the leaderboard.'
                : leaderboardSubmission === 'duplicate' ? 'This run was already submitted.'
                : leaderboardSubmission === 'not-better' ? kind === 'campaign' ? 'Run recorded. Your Campaign leaderboard best remains unchanged.' : 'Run recorded. Your leaderboard best remains unchanged.'
                : leaderboardSubmission === 'unauthenticated' ? 'Sign in with Google to submit leaderboard scores.'
                : leaderboardSubmission === 'unavailable' ? 'Could not submit while offline. Your game progress is safe.'
                : leaderboardSubmission === 'rejected' ? 'Firebase rejected this score submission. Check the deployed rules.'
                : 'Could not submit this score.'}
            </T>
            {leaderboardSubmission === 'unavailable' || leaderboardSubmission === 'error' ? (
              <Button label="Retry score submission" variant="secondary" height={44} onPress={onRetryLeaderboard} />
            ) : null}
          </View>
        ) : null}
        {data.badges.length ? (
          <View style={{ alignSelf: 'stretch', gap: 8, padding: 12, borderRadius: 16, backgroundColor: t.accentSoft }}>
            <T v="cap" color={t.accent}>{data.badges.length > 1 ? 'NEW BADGES' : 'NEW BADGE'}</T>
            {data.badges.slice(0, 3).map((id) => {
              const a = achievementById(id);
              return a ? (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Badge a={a} earned size={48} />
                  <View style={{ flex: 1 }}><T v="title">{a.name}</T><T v="cap">{a.desc}</T></View>
                </View>
              ) : null;
            })}
          </View>
        ) : null}
        {ch && ch < 8 ? (
          <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: t.accentSoft }}>
            <CellPreview kind={CHAPTERS[ch].cells as never} size={44} t={t} n={1} />
            <View style={{ flex: 1 }}>
              <T v="cap">Next up</T>
              <T v="small" color={t.text}>{CHAPTERS[ch].name}: {CHAPTERS[ch].mech}</T>
            </View>
          </View>
        ) : null}
        <View style={{ alignSelf: 'stretch', gap: 8 }}>
          <Button label={kind === 'campaign' ? (data.campaignComplete || level.index === 250 ? 'Return to campaign map' : unlockedWorld ? 'Continue campaign' : 'Next campaign level') : kind === 'classic' ? 'Next level' : kind === 'chaos' || kind === 'master' ? 'Next puzzle' : 'Done'} onPress={onNext} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Retry" variant="secondary" height={48} flex={1} onPress={onRetry} />
            <Button label="Share" variant="secondary" height={48} flex={1} icon="share" onPress={share} />
          </View>
          <Button label="Home" variant="ghost" height={44} onPress={onHome} />
        </View>
      </Sheet>
    </Overlay>
  );
}

export function FailedView({ level, state, canUndo, onUndo, onRetry, onSkip }: {
  level: Level; state: GameState; canUndo: boolean; onUndo: () => void; onRetry: () => void; onSkip?: () => void;
}) {
  const { t } = useTheme();
  const usedMoves = level.boss ? state.budgetMoves ?? state.moves : state.moves;
  const f = failTitle(state.fail ?? 'moves', usedMoves, level.boss?.moveLimit ?? level.maxMoves);
  return (
    <Overlay anchor="bottom">
      <Sheet>
        <T v="h3" color={t.danger}>{f.title}</T>
        <T v="body">{f.body}</T>
        <Button label="Undo last move" variant="secondary" disabled={!canUndo} onPress={onUndo} />
        <Button label="Retry level" onPress={onRetry} />
        {onSkip ? <Button label="Skip" variant="ghost" onPress={onSkip} /> : null}
      </Sheet>
    </Overlay>
  );
}

export function PauseSheet({ onResume, onRestart, onHowTo, onSettings, onQuit }: {
  onResume: () => void; onRestart: () => void; onHowTo: () => void; onSettings: () => void; onQuit: () => void;
}) {
  return (
    <Overlay anchor="bottom" onDismiss={onResume}>
      <Sheet>
        <T v="h3">Paused</T>
        <Button label="Resume" onPress={onResume} />
        <Button label="Restart level" variant="secondary" onPress={onRestart} />
        <UpdateNotice />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="How to play" variant="secondary" height={48} flex={1} onPress={onHowTo} />
          <Button label="Settings" variant="secondary" height={48} flex={1} onPress={onSettings} />
        </View>
        <Button label="Quit to menu" variant="ghost" onPress={onQuit} />
      </Sheet>
    </Overlay>
  );
}

export function ConfirmRestart({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <Overlay anchor="center" onDismiss={onNo}>
      <Sheet>
        <T v="h3">Restart this level?</T>
        <T v="body">Your current path will be cleared.</T>
        <Button label="Restart" variant="destructive" onPress={onYes} />
        <Button label="Keep playing" variant="ghost" onPress={onNo} />
      </Sheet>
    </Overlay>
  );
}

function hintCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function HintLimit({ refillMs, onClose }: { refillMs: number | null; onClose: () => void }) {
  return (
    <Overlay anchor="center" onDismiss={onClose}>
      <Sheet>
        <T v="h3">No hints left</T>
        <T v="body">Your {MAX_HINTS} hints refill together 24 hours after you first use one.</T>
        <T v="title">Next refill in {hintCountdown(refillMs ?? 24 * 60 * 60 * 1000)}</T>
        <Button label="Got it" onPress={onClose} />
      </Sheet>
    </Overlay>
  );
}

export function MechIntro({ info, onClose }: { info: { title: string; body: string; kind: string }; onClose: () => void }) {
  const { t } = useTheme();
  return (
    <Overlay anchor="center" onDismiss={onClose}>
      <Sheet style={{ alignItems: 'center' }}>
        <T v="cap" color={t.accent}>NEW CELL</T>
        <CellPreview kind={info.kind as never} size={84} t={t} n={1} dir="r" />
        <T v="h3">{info.title}</T>
        <T v="body" align="center">{info.body}</T>
        <View style={{ alignSelf: 'stretch' }}><Button label="Got it" onPress={onClose} /></View>
      </Sheet>
    </Overlay>
  );
}

export function RunOver({ kind, score, best, onAgain, onHome }: { kind: 'rush' | 'endless'; score: number; best: number; onAgain: () => void; onHome: () => void }) {
  const { t } = useTheme();
  return (
    <Overlay anchor="center">
      <Sheet style={{ alignItems: 'center' }}>
        <T v="cap" color={t.accent}>{kind === 'rush' ? 'TIME’S UP' : 'RUN OVER'}</T>
        <T v="display">{score}</T>
        <T v="body">puzzles solved{score >= best && score > 0 ? ' · new best!' : ` · best ${best}`}</T>
        <UpdateNotice />
        <View style={{ alignSelf: 'stretch', gap: 8 }}>
          <Button label="Play again" onPress={onAgain} />
          <Button label="Home" variant="ghost" onPress={onHome} />
        </View>
      </Sheet>
    </Overlay>
  );
}

export function AchToast({ ids }: { ids: string[] }) {
  const { t } = useTheme();
  const list = ids.map((i) => achievementById(i)).filter(Boolean) as AchievementDef[];
  if (!list.length) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 56, left: 16, right: 16, backgroundColor: t.text, borderRadius: 20, padding: 12, gap: 8, elevation: 12 }}>
      <T v="cap" color={t.bg}>{list.length > 1 ? `${list.length} BADGES UNLOCKED` : 'BADGE UNLOCKED'}</T>
      {list.slice(0, 3).map((a) => (
        <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Badge a={a} earned size={52} />
          <View style={{ flex: 1 }}>
            <T v="title" color={t.bg}>{a.name}</T>
            <T v="cap" color={t.bg}>{a.desc}</T>
          </View>
        </View>
      ))}
    </View>
  );
}
