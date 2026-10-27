import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon, StarShape } from '../components/Icon';
import { Button, Card, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import {
  CAMPAIGN_LEVEL_DEFS, CAMPAIGN_WORLDS, CampaignWorld, campaignComplete,
  campaignCurrentLevel, campaignLevelId, campaignLevelUnlocked,
  campaignWorldComplete, campaignWorldUnlocked,
} from '../lib/levels';
import { LevelRecord, useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';

const WORLD_ROW_HEIGHT = 370;
const MAP_HEIGHT = 218;
const NODE_X = [0.16, 0.69, 0.43, 0.82, 0.16];
const NODE_Y = [23, 66, 109, 152, 195];

function CampaignNode({ world, number, record, unlocked, current, onPress }: {
  world: CampaignWorld; number: number; record?: LevelRecord; unlocked: boolean; current: boolean; onPress: () => void;
}) {
  const { t } = useTheme();
  return (
    <Pressable disabled={!unlocked} onPress={onPress} accessibilityRole="button"
      accessibilityLabel={`Level ${number}${current ? ', current level' : record ? `, completed with ${record.stars} stars` : unlocked ? ', available' : ', locked'}`}
      style={{ position: 'absolute', left: `${NODE_X[(number - world.firstLevel) % 5] * 100}%`, top: NODE_Y[(number - world.firstLevel) % 5] - 22, width: 48, height: 48, marginLeft: -24, alignItems: 'center', justifyContent: 'center' }}>
      {current ? <View style={{ position: 'absolute', top: -15, minWidth: 34, paddingHorizontal: 4, borderRadius: 8, backgroundColor: world.palette.accent, alignItems: 'center' }}><Text style={{ fontSize: 8, fontWeight: '900', color: '#121820' }}>YOU</Text></View> : null}
      <View style={{ width: 43, height: 43, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: record ? world.palette.accent : unlocked ? t.raised : '#202332', borderWidth: current ? 3 : 1.5, borderColor: unlocked ? world.palette.glow : '#596171', opacity: unlocked ? 1 : 0.74, shadowColor: world.palette.glow, shadowOpacity: current ? 0.8 : 0.15, shadowRadius: current ? 10 : 3, elevation: current ? 5 : 1 }}>
        {unlocked ? <T v="cap" color={record ? '#10151D' : t.text}>{number}</T> : <Icon name="lock" size={15} color="#A6ACBA" />}
      </View>
      {record ? <View style={{ position: 'absolute', bottom: -5, flexDirection: 'row' }}>{[1, 2, 3].map((star) => <StarShape key={star} size={10} filled={star <= record.stars} color={world.palette.glow} empty="#6F7786" />)}</View> : null}
    </Pressable>
  );
}

const CampaignWorldSection = memo(function CampaignWorldSection({ world, levels, currentLevel, onStart }: {
  world: CampaignWorld; levels: Record<string, LevelRecord>; currentLevel: number; onStart: (number: number) => void;
}) {
  const { t } = useTheme();
  const [width, setWidth] = useState(0);
  const unlocked = campaignWorldUnlocked(levels, world.id);
  const complete = campaignWorldComplete(levels, world.id);
  const solved = world.levelIds.filter((id) => !!levels[id]).length;
  const points = NODE_X.map((x, i) => [Math.max(24, Math.min(width - 24, width * x)), NODE_Y[i]] as const);
  const path = points.reduce((d, point, i) => {
    if (i === 0) return `M ${point[0]} ${point[1]}`;
    const prev = points[i - 1];
    const midY = (prev[1] + point[1]) / 2;
    return `${d} Q ${prev[0]} ${midY} ${point[0]} ${point[1]}`;
  }, '');

  return (
    <View style={{ height: WORLD_ROW_HEIGHT, paddingHorizontal: 14, paddingBottom: 12 }}>
      <Card style={{ flex: 1, padding: 0, overflow: 'hidden', borderColor: `${world.palette.accent}99`, opacity: unlocked ? 1 : 0.84 }}>
        <LinearGradient colors={[world.background.from, world.background.to]} style={{ flex: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
          <View style={{ position: 'absolute', right: 13, top: 2, opacity: 0.16 }}>
            <Text style={{ fontSize: 72, color: world.palette.glow }}>{world.motif}</Text>
          </View>
          <View style={{ minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: `${world.palette.accent}28`, borderWidth: 1, borderColor: `${world.palette.glow}99` }}>
              {unlocked ? <Text style={{ color: world.palette.glow, fontSize: 20 }}>{world.motif}</Text> : <Icon name="lock" size={18} color="#A6ACBA" />}
            </View>
            <View style={{ flex: 1 }}>
              <T v="title" color={unlocked ? world.palette.glow : '#C0C4CF'}>{world.id}. {world.name}</T>
              <T v="cap" color="#D0D4DF">{world.description}</T>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              {complete ? <Icon name="check" size={18} color={world.palette.glow} /> : null}
              <T v="cap" color={world.palette.glow}>{solved}/5</T>
            </View>
          </View>

          <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: MAP_HEIGHT, position: 'relative' }}>
            {width > 0 ? <Svg pointerEvents="none" width={width} height={MAP_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }}>
              <Path d={path} fill="none" stroke={`${world.palette.glow}77`} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              <Path d={path} fill="none" stroke={`${world.palette.accent}EE`} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 8" />
              {points.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={4} fill={world.palette.glow} />)}
            </Svg> : null}
            {world.levelIds.map((id, index) => {
              const number = world.firstLevel + index;
              const record = levels[id];
              const canPlay = unlocked && campaignLevelUnlocked(levels, number);
              return <CampaignNode key={id} world={world} number={number} record={record} unlocked={canPlay} current={!record && currentLevel === number} onPress={() => onStart(number)} />;
            })}
          </View>

          <View style={{ justifyContent: 'center', minHeight: 34 }}>
            <T v="cap" color="#D0D4DF">{world.theme} · {world.background.treatment}</T>
            <T v="cap" color={world.palette.glow}>{world.challenge}</T>
          </View>
          {!unlocked ? <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#11182755', justifyContent: 'center', alignItems: 'center' }} pointerEvents="none"><T v="cap" color="#E3E6EE">Complete World {world.unlockAfterWorld} to open</T></View> : null}
        </LinearGradient>
      </Card>
      {world.id < CAMPAIGN_WORLDS.length ? <View style={{ position: 'absolute', bottom: 0, left: '16%', width: 3, height: 12, backgroundColor: world.palette.accent, opacity: 0.8 }} /> : null}
    </View>
  );
});

export function CampaignScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const levels = useStore((s) => s.levels);
  const list = useRef<FlatList<CampaignWorld>>(null);
  const completeCount = useMemo(() => CAMPAIGN_LEVEL_DEFS.filter((def) => !!levels[def.id]).length, [levels]);
  const complete = campaignComplete(levels);
  const currentLevel = campaignCurrentLevel(levels);
  const currentWorld = Math.min(CAMPAIGN_WORLDS.length, Math.ceil(currentLevel / 5));

  useEffect(() => {
    const timer = setTimeout(() => list.current?.scrollToIndex({ index: currentWorld - 1, animated: false, viewPosition: 0.12 }), 100);
    return () => clearTimeout(timer);
  }, [currentWorld]);

  const start = useCallback((number: number) => {
    const id = campaignLevelId(number);
    const world = CAMPAIGN_WORLDS[Math.ceil(number / 5) - 1];
    if (world && campaignWorldUnlocked(levels, world.id) && campaignLevelUnlocked(levels, number)) nav.startGame({ kind: 'campaign', levelId: id });
  }, [levels, nav]);
  const jump = () => {
    if (complete) list.current?.scrollToIndex({ index: CAMPAIGN_WORLDS.length - 1, animated: true, viewPosition: 0.12 });
    else start(currentLevel);
  };
  const renderWorld = useCallback(({ item }: { item: CampaignWorld }) => <CampaignWorldSection world={item} levels={levels} currentLevel={currentLevel} onStart={start} />, [levels, currentLevel, start]);
  const getItemLayout = useCallback((_: ArrayLike<CampaignWorld> | null | undefined, index: number) => ({ length: WORLD_ROW_HEIGHT, offset: WORLD_ROW_HEIGHT * index, index }), []);
  const onScrollToIndexFailed = useCallback(({ index }: { index: number }) => {
    list.current?.scrollToOffset({ offset: WORLD_ROW_HEIGHT * index, animated: false });
  }, []);

  return (
    <Screen>
      <TopBar title="Campaign Adventure" sub={`${completeCount} / 250 levels complete`} onBack={() => nav.canGoBack ? nav.pop() : nav.reset({ name: 'modes' })} />
      <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
        <Button label={complete ? 'View World 50 · Campaign finale' : `Jump to current · Level ${currentLevel}`} icon={complete ? 'star' : 'play'} variant="secondary" height={44} onPress={jump} />
      </View>
      <FlatList ref={list} data={CAMPAIGN_WORLDS} renderItem={renderWorld} keyExtractor={(world) => String(world.id)}
        getItemLayout={getItemLayout} onScrollToIndexFailed={onScrollToIndexFailed} initialNumToRender={3}
        maxToRenderPerBatch={3} windowSize={5} removeClippedSubviews keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 18 }} showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={{ height: 8 }} />} />
      <View accessibilityRole="text" accessibilityLabel={`Campaign progress ${completeCount} of 250 levels`} style={{ alignSelf: 'center', paddingVertical: 5 }}>
        <T v="cap" color={t.text2}>50 worlds · 250 levels · progress saves automatically</T>
      </View>
    </Screen>
  );
}
