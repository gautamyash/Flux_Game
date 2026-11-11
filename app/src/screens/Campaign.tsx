import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DimensionValue, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon, StarShape } from '../components/Icon';
import { Button, Card, Screen, T, TopBar } from '../components/ui';
import { useNav } from '../nav/Nav';
import {
  CAMPAIGN_LEVEL_DEFS,
  CAMPAIGN_PROGRESSION_DEFS,
  CAMPAIGN_WORLDS,
  CampaignWorld,
  campaignBossLevelId,
  campaignBossUnlocked,
  campaignComplete,
  campaignCurrentDef,
  campaignLevelUnlocked,
  campaignWorldComplete,
  campaignWorldUnlocked,
} from '../lib/levels';
import { LevelRecord, useStore } from '../store/store';
import { useTheme } from '../theme/ThemeProvider';

export const WORLD_ROW_HEIGHT = 424;
const MAP_HEIGHT = 260;
const NODE_X = [0.20, 0.74, 0.30, 0.78, 0.22, 0.66];
const NODE_Y = [32, 74, 120, 164, 208, 244];

export interface CampaignSector {
  id: number;
  name: string;
  range: string;
  grid: string;
  color: string;
  startWorld: number;
}

export const CAMPAIGN_SECTORS: CampaignSector[] = [
  { id: 1, name: 'Origins', range: 'W1–10', grid: '4×4', color: '#32D6D0', startWorld: 1 },
  { id: 2, name: 'Mystic', range: 'W11–20', grid: '5×5', color: '#45D5C7', startWorld: 11 },
  { id: 3, name: 'Cosmic', range: 'W21–30', grid: '6×6', color: '#7398FF', startWorld: 21 },
  { id: 4, name: 'Aether', range: 'W31–40', grid: '7×7', color: '#DB754A', startWorld: 31 },
  { id: 5, name: 'Summit', range: 'W41–50', grid: '8×8', color: '#FFE078', startWorld: 41 },
];

function CampaignNode({
  world,
  number,
  record,
  unlocked,
  current,
  mystery,
  boss,
  onPress,
}: {
  world: CampaignWorld;
  number: number;
  record?: LevelRecord;
  unlocked: boolean;
  current: boolean;
  mystery?: boolean;
  boss?: boolean;
  onPress: () => void;
}) {
  const { t } = useTheme();
  const label = boss ? `World ${world.id} Boss` : mystery ? `Mystery Stage ${number}` : `Level ${number}`;
  const nodeIndex = boss ? 5 : (number - world.firstLevel) % 5;
  const leftPct: DimensionValue = `${NODE_X[nodeIndex] * 100}%`;
  const topPx = NODE_Y[nodeIndex];

  // 1. BOSS STAGE NODE (Citadel Fortress)
  if (boss) {
    return (
      <Pressable
        disabled={!unlocked}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}${current ? ', current stage' : record ? `, defeated with ${record.stars} stars` : unlocked ? ', challenge available' : ', locked'}`}
        style={{
          position: 'absolute',
          left: leftPct,
          top: topPx - 29,
          width: 58,
          height: 58,
          marginLeft: -29,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: current ? 10 : 2,
        }}
      >
        {/* Boss Crest Banner */}
        <View
          style={{
            position: 'absolute',
            top: -15,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 6,
            backgroundColor: record ? '#FFD700' : current ? '#FF4757' : '#301808',
            borderWidth: 1,
            borderColor: record ? '#FFE57F' : '#FFA000',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 3,
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: '900',
              color: record ? '#161003' : '#FFFFFF',
              letterSpacing: 0.5,
            }}
          >
            {record ? 'DEFEATED' : current ? 'YOU · ⚔ BOSS' : '⚔ BOSS'}
          </Text>
        </View>

        {/* Boss Citadel Container */}
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: record
              ? '#2A2008'
              : unlocked
                ? '#240A12'
                : '#1A1822',
            borderWidth: 3,
            borderColor: record ? '#FFD700' : unlocked ? '#FF5E57' : '#5C4B30',
            opacity: unlocked ? 1 : 0.65,
            shadowColor: record ? '#FFD700' : '#FF5E57',
            shadowOpacity: current || record ? 0.7 : 0.25,
            shadowRadius: current ? 10 : 5,
            elevation: current ? 6 : 2,
          }}
        >
          {unlocked ? (
            <Text
              style={{
                fontSize: record ? 20 : 18,
                fontWeight: '900',
                color: record ? '#FFD700' : '#FFA000',
              }}
            >
              {record ? '★' : '⚔'}
            </Text>
          ) : (
            <Icon name="lock" size={16} color="#8A7F68" />
          )}
        </View>

        {/* Star Laurels */}
        {record ? (
          <View style={{ position: 'absolute', bottom: -7, flexDirection: 'row', gap: 1 }}>
            {[1, 2, 3].map((star) => (
              <StarShape
                key={star}
                size={11}
                filled={star <= record.stars}
                color="#FFD700"
                empty="#574925"
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    );
  }

  // 2. MYSTERY STAGE NODE (Diamond Crystal Rift)
  if (mystery) {
    return (
      <Pressable
        disabled={!unlocked}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}${current ? ', current stage' : record ? `, completed with ${record.stars} stars` : unlocked ? ', available' : ', locked'}`}
        style={{
          position: 'absolute',
          left: leftPct,
          top: topPx - 25,
          width: 50,
          height: 50,
          marginLeft: -25,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: current ? 10 : 2,
        }}
      >
        {/* Mystery Tag Pill */}
        <View
          style={{
            position: 'absolute',
            top: -15,
            paddingHorizontal: 5,
            paddingVertical: 1,
            borderRadius: 6,
            backgroundColor: current ? world.palette.accent : '#2C104D',
            borderWidth: 1,
            borderColor: '#C084FC',
            alignItems: 'center',
            shadowColor: '#A855F7',
            shadowOpacity: 0.3,
            shadowRadius: 3,
            elevation: 3,
          }}
        >
          <Text
            style={{
              fontSize: 7.5,
              fontWeight: '900',
              color: current ? '#10151D' : '#E9D5FF',
              letterSpacing: 0.5,
            }}
          >
            {current ? 'YOU · ✦' : '✦ MYSTERY'}
          </Text>
        </View>

        {/* Diamond Crystal (Rotated 45 degrees) */}
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            transform: [{ rotate: '45deg' }],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: record
              ? '#7E22CE'
              : unlocked
                ? '#1E1433'
                : '#181422',
            borderWidth: 2,
            borderColor: record ? '#E9D5FF' : unlocked ? '#C084FC' : '#4C3B63',
            opacity: unlocked ? 1 : 0.65,
            shadowColor: '#C084FC',
            shadowOpacity: current || record ? 0.6 : 0.2,
            shadowRadius: current ? 8 : 4,
            elevation: current ? 5 : 2,
          }}
        >
          <View style={{ transform: [{ rotate: '-45deg' }] }}>
            {unlocked ? (
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '900',
                  color: record ? '#FFFFFF' : '#E9D5FF',
                }}
              >
                {record ? '✦' : '?'}
              </Text>
            ) : (
              <Icon name="lock" size={14} color="#7D6F94" />
            )}
          </View>
        </View>

        {/* Star Tray */}
        {record ? (
          <View style={{ position: 'absolute', bottom: -7, flexDirection: 'row', gap: 1 }}>
            {[1, 2, 3].map((star) => (
              <StarShape
                key={star}
                size={10}
                filled={star <= record.stars}
                color="#D8B4FE"
                empty="#4A3B63"
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    );
  }

  // 3. REGULAR LEVEL NODE (Circular Energy Orb)
  return (
    <Pressable
      disabled={!unlocked}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${current ? ', current level' : record ? `, completed with ${record.stars} stars` : unlocked ? ', available' : ', locked'}`}
      style={{
        position: 'absolute',
        left: leftPct,
        top: topPx - 23,
        width: 46,
        height: 46,
        marginLeft: -23,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: current ? 10 : 1,
      }}
    >
      {/* Current Beacon Tag */}
      {current ? (
        <View
          style={{
            position: 'absolute',
            top: -15,
            minWidth: 32,
            paddingHorizontal: 4,
            paddingVertical: 1,
            borderRadius: 6,
            backgroundColor: world.palette.accent,
            alignItems: 'center',
            shadowColor: world.palette.glow,
            shadowOpacity: 0.6,
            shadowRadius: 4,
            elevation: 4,
          }}
        >
          <Text style={{ fontSize: 8, fontWeight: '900', color: '#10151D' }}>YOU</Text>
        </View>
      ) : null}

      {/* Circular Orb */}
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: record
            ? world.palette.accent
            : unlocked
              ? '#141824'
              : '#161922',
          borderWidth: current ? 2.5 : 2,
          borderColor: unlocked ? world.palette.glow : '#3A4252',
          opacity: unlocked ? 1 : 0.65,
          shadowColor: world.palette.glow,
          shadowOpacity: current || record ? 0.5 : 0.15,
          shadowRadius: current ? 8 : 3,
          elevation: current ? 4 : 1,
        }}
      >
        {unlocked ? (
          <Text
            style={{
              fontSize: 14,
              fontWeight: '800',
              color: record ? '#0E141D' : world.palette.glow,
            }}
          >
            {number}
          </Text>
        ) : (
          <Icon name="lock" size={14} color="#6C7588" />
        )}
      </View>

      {/* Star Tray */}
      {record ? (
        <View style={{ position: 'absolute', bottom: -6, flexDirection: 'row', gap: 1 }}>
          {[1, 2, 3].map((star) => (
            <StarShape
              key={star}
              size={10}
              filled={star <= record.stars}
              color={world.palette.glow}
              empty="#454D5D"
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const CampaignWorldSection = memo(function CampaignWorldSection({
  world,
  levels,
  currentId,
  onStart,
}: {
  world: CampaignWorld;
  levels: Record<string, LevelRecord>;
  currentId: string;
  onStart: (id: string) => void;
}) {
  const { t } = useTheme();
  const [width, setWidth] = useState(0);

  const unlocked = campaignWorldUnlocked(levels, world.id);
  const complete = campaignWorldComplete(levels, world.id);
  const solved = world.levelIds.filter((id) => !!levels[id]).length;
  const bossId = campaignBossLevelId(world.id);
  const bossRecord = levels[bossId];

  const worldStars = useMemo(() => {
    let count = 0;
    for (const id of world.levelIds) {
      if (levels[id]?.stars) count += levels[id].stars;
    }
    if (bossRecord?.stars) count += bossRecord.stars;
    return count;
  }, [world.levelIds, levels, bossRecord]);

  const points = NODE_X.map(
    (x, i) => [Math.max(28, Math.min(width - 28, width * x)), NODE_Y[i]] as const
  );

  // Smooth Bezier path joining all nodes inside the world
  const pathD = points.reduce((d, point, i) => {
    if (i === 0) return `M ${point[0]} ${point[1]}`;
    const prev = points[i - 1];
    const midY = (prev[1] + point[1]) / 2;
    return `${d} Q ${prev[0]} ${midY} ${point[0]} ${point[1]}`;
  }, '');

  // Entrance bridge coming from previous world boss
  const entranceD =
    width > 0 && world.id > 1
      ? `M ${width * 0.66} -18 Q ${width * 0.66} 8 ${points[0][0]} ${points[0][1]}`
      : '';

  // Exit bridge leading into next world entrance
  const exitD =
    width > 0 && world.id < CAMPAIGN_WORLDS.length
      ? `M ${points[5][0]} ${points[5][1]} Q ${points[5][0]} ${MAP_HEIGHT + 14} ${width * 0.20} ${MAP_HEIGHT + 36}`
      : '';

  const sectorNum = Math.ceil(world.id / 10);
  const gridSize = 4 + Math.floor((world.id - 1) / 10);

  return (
    <View style={{ height: WORLD_ROW_HEIGHT, paddingHorizontal: 12, paddingBottom: 12 }}>
      <Card
        style={{
          flex: 1,
          padding: 0,
          overflow: 'hidden',
          borderColor: unlocked ? `${world.palette.accent}77` : '#232938',
          borderWidth: 1.5,
          opacity: unlocked ? 1 : 0.82,
        }}
      >
        <LinearGradient
          colors={[world.background.from, world.background.to]}
          style={{ flex: 1, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 }}
        >
          {/* Ambient Background Watermark */}
          <View style={{ position: 'absolute', right: 12, top: 4, opacity: 0.12 }} pointerEvents="none">
            <Text style={{ fontSize: 88, color: world.palette.glow }}>{world.motif}</Text>
          </View>

          {/* World Territory Header */}
          <View style={{ minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {/* Biome Emblem */}
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: `${world.palette.accent}24`,
                borderWidth: 1.5,
                borderColor: unlocked ? `${world.palette.glow}99` : '#3E4656',
              }}
            >
              {unlocked ? (
                <Text style={{ color: world.palette.glow, fontSize: 22 }}>{world.motif}</Text>
              ) : (
                <Icon name="lock" size={18} color="#7E8799" />
              )}
            </View>

            {/* World Title & Sector Subtitle */}
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <T v="title" color={unlocked ? world.palette.glow : '#A6ACB8'}>
                  {world.id}. {world.name}
                </T>
                {complete ? <Icon name="check" size={16} color={world.palette.glow} /> : null}
              </View>
              <Text style={{ fontSize: 11, color: '#BAC2D2', marginTop: 1 }}>
                Sector {sectorNum} · {gridSize}×{gridSize} · {world.theme}
              </Text>
            </View>

            {/* Stars & Progress Tag */}
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 8,
                  backgroundColor: '#11162488',
                  borderWidth: 1,
                  borderColor: unlocked ? `${world.palette.glow}66` : '#303646',
                }}
              >
                <StarShape size={11} filled color="#FFD700" empty="#505767" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFD700' }}>
                  {worldStars}/18
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  color: complete
                    ? world.palette.glow
                    : bossRecord
                      ? '#FFD700'
                      : '#8E98AC',
                }}
              >
                {complete
                  ? 'REALM CLEARED'
                  : bossRecord
                    ? 'BOSS WON'
                    : `${solved}/5 STAGES`}
              </Text>
            </View>
          </View>

          {/* Map Exploration Canvas */}
          <View
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={{ height: MAP_HEIGHT, position: 'relative' }}
          >
            {width > 0 ? (
              <Svg pointerEvents="none" width={width} height={MAP_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }}>
                {/* Entrance Bridge from previous world */}
                {entranceD ? (
                  <Path
                    d={entranceD}
                    fill="none"
                    stroke={`${world.palette.glow}44`}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray="4 6"
                  />
                ) : null}

                {/* Outer Glowing Energy Path */}
                <Path
                  d={pathD}
                  fill="none"
                  stroke={`${world.palette.glow}28`}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Core Energy Conduits */}
                <Path
                  d={pathD}
                  fill="none"
                  stroke={`${world.palette.glow}88`}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d={pathD}
                  fill="none"
                  stroke={`${world.palette.accent}EE`}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="5 7"
                />

                {/* Exit Bridge to next world */}
                {exitD ? (
                  <Path
                    d={exitD}
                    fill="none"
                    stroke={`${world.palette.glow}44`}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray="4 6"
                  />
                ) : null}

                {/* Route waypoint dots */}
                {points.map(([x, y], i) => (
                  <Circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={i === 5 ? 6 : i === 4 ? 5 : 4}
                    fill={i === 5 ? '#FFD700' : i === 4 ? '#C084FC' : world.palette.glow}
                  />
                ))}
              </Svg>
            ) : null}

            {/* Stages 1 to 5 */}
            {world.levelIds.map((id, index) => {
              const number = world.firstLevel + index;
              const record = levels[id];
              const canPlay = unlocked && campaignLevelUnlocked(levels, number);
              const mystery = !!CAMPAIGN_LEVEL_DEFS[number - 1]?.mystery;
              return (
                <CampaignNode
                  key={id}
                  world={world}
                  number={number}
                  record={record}
                  unlocked={canPlay}
                  current={currentId === id}
                  mystery={mystery}
                  onPress={() => onStart(id)}
                />
              );
            })}

            {/* Stage 6: World Boss Citadel */}
            <CampaignNode
              key={bossId}
              world={world}
              number={world.id}
              record={bossRecord}
              unlocked={unlocked && campaignBossUnlocked(levels, world.id)}
              current={currentId === bossId}
              boss
              onPress={() => onStart(bossId)}
            />
          </View>

          {/* World Biome Details & Challenge Brief */}
          <View style={{ justifyContent: 'center', minHeight: 38, borderTopWidth: 1, borderTopColor: '#FFFFFF12', paddingTop: 4 }}>
            <Text style={{ fontSize: 11, color: '#C8CFDC', fontStyle: 'italic' }}>
              {world.description}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: world.palette.glow, marginTop: 1 }}>
              {world.challenge}
            </Text>
          </View>

          {/* Atmospheric Locked Shroud (Fog of War) */}
          {!unlocked ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: '#090E1AEA',
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 24,
                gap: 8,
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: '#161D2B',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: '#4A5568',
                }}
              >
                <Icon name="lock" size={20} color="#CBD5E0" />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#E2E8F0', letterSpacing: 0.5 }}>
                LOCKED REALM
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                Defeat World {world.unlockAfterWorld} Boss to unveil {world.name}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
      </Card>
    </View>
  );
});

export function CampaignScreen() {
  const nav = useNav();
  const { t } = useTheme();
  const levels = useStore((s) => s.campaignLevels);
  const list = useRef<FlatList<CampaignWorld>>(null);

  const completeCount = useMemo(
    () => CAMPAIGN_PROGRESSION_DEFS.filter((def) => !!levels[def.id]).length,
    [levels]
  );
  const complete = campaignComplete(levels);
  const currentDef = campaignCurrentDef(levels);
  const currentWorld = currentDef.boss?.campaignWorld ?? Math.ceil(currentDef.index / 5);

  const totalStars = useMemo(() => {
    return CAMPAIGN_PROGRESSION_DEFS.reduce(
      (sum, def) => sum + (levels[def.id]?.stars ?? 0),
      0
    );
  }, [levels]);

  useEffect(() => {
    const timer = setTimeout(
      () =>
        list.current?.scrollToIndex({
          index: Math.max(0, currentWorld - 1),
          animated: false,
          viewPosition: 0.12,
        }),
      100
    );
    return () => clearTimeout(timer);
  }, [currentWorld]);

  const start = useCallback(
    (id: string) => {
      const world = CAMPAIGN_WORLDS.find(
        (candidate) =>
          candidate.levelIds.includes(id) || campaignBossLevelId(candidate.id) === id
      );
      const number = CAMPAIGN_LEVEL_DEFS.find((def) => def.id === id)?.index;
      if (
        world &&
        campaignWorldUnlocked(levels, world.id) &&
        (number === undefined
          ? campaignBossUnlocked(levels, world.id)
          : campaignLevelUnlocked(levels, number))
      ) {
        nav.startGame({ kind: 'campaign', levelId: id });
      }
    },
    [levels, nav]
  );

  const jump = () => {
    if (complete) {
      list.current?.scrollToIndex({
        index: CAMPAIGN_WORLDS.length - 1,
        animated: true,
        viewPosition: 0.12,
      });
    } else {
      start(currentDef.id);
    }
  };

  const renderWorld = useCallback(
    ({ item }: { item: CampaignWorld }) => (
      <CampaignWorldSection
        world={item}
        levels={levels}
        currentId={currentDef.id}
        onStart={start}
      />
    ),
    [levels, currentDef.id, start]
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<CampaignWorld> | null | undefined, index: number) => ({
      length: WORLD_ROW_HEIGHT,
      offset: WORLD_ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const onScrollToIndexFailed = useCallback(({ index }: { index: number }) => {
    list.current?.scrollToOffset({ offset: WORLD_ROW_HEIGHT * index, animated: false });
  }, []);

  return (
    <Screen>
      <TopBar
        title="Campaign Adventure"
        sub={`${completeCount} / 300 stages complete · ★ ${totalStars} stars`}
        onBack={() => (nav.canGoBack ? nav.pop() : nav.reset({ name: 'modes' }))}
      />

      {/* Progress Bar & Summary */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: '#1D2434',
            overflow: 'hidden',
            marginBottom: 6,
          }}
        >
          <View
            style={{
              width: `${Math.min(100, Math.max(1, (completeCount / 300) * 100))}%`,
              height: '100%',
              backgroundColor: '#32D6D0',
            }}
          />
        </View>

        {/* Sector Quick-Jump Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        >
          {CAMPAIGN_SECTORS.map((sec) => {
            const active = currentWorld >= sec.startWorld && currentWorld < sec.startWorld + 10;
            return (
              <Pressable
                key={sec.id}
                onPress={() =>
                  list.current?.scrollToIndex({
                    index: sec.startWorld - 1,
                    animated: true,
                    viewPosition: 0,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Jump to Sector ${sec.id} ${sec.name}, Worlds ${sec.range}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 10,
                  backgroundColor: active ? `${sec.color}24` : '#161B28',
                  borderWidth: 1.5,
                  borderColor: active ? sec.color : '#2E3547',
                }}
              >
                <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: sec.color }} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: active ? '#FFFFFF' : '#B0B8C8',
                  }}
                >
                  {sec.name}
                </Text>
                <Text
                  style={{
                    fontSize: 9.5,
                    fontWeight: '600',
                    color: active ? sec.color : '#6E788C',
                  }}
                >
                  {sec.range} · {sec.grid}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Jump to Current / Finale Button */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
        <Button
          label={
            complete
              ? '★ Campaign Finale · View World 50'
              : `Jump to current · ${currentDef.boss ? `World ${currentDef.boss.campaignWorld} Boss` : `Level ${currentDef.index}`}`
          }
          icon={complete ? 'star' : 'play'}
          variant="secondary"
          height={44}
          onPress={jump}
        />
      </View>

      {/* 50-World Adventure Map Stream */}
      <FlatList
        ref={list}
        data={CAMPAIGN_WORLDS}
        renderItem={renderWorld}
        keyExtractor={(world) => String(world.id)}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={<View style={{ height: 8 }} />}
      />

      {/* Footer Navigation & Progress Info */}
      <View
        accessibilityRole="text"
        accessibilityLabel={`Campaign progress ${completeCount} of 300 stages, ${totalStars} stars`}
        style={{ alignSelf: 'center', paddingVertical: 4 }}
      >
        <T v="cap" color={t.text2}>
          50 worlds · 250 levels · 50 bosses · progress saves automatically
        </T>
      </View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 8 }}>
        <Button
          label="Campaign leaderboard"
          icon="trophy"
          variant="secondary"
          height={42}
          onPress={() => nav.push({ name: 'leaderboard', kind: 'campaign' })}
        />
      </View>
    </Screen>
  );
}