/**
 * Community Screen.
 *
 * 게시판을 역할별로 쪼개지 않는다. 글이 흩어지면 어느 방에서도 대화가 안 된다.
 * 대신 글마다 글쓴이의 역할을 배지로 붙여 누가 쓴 글인지 구분한다.
 *
 * 운영자가 정리한 글은 목록에 섞지 않고 위에 따로 세운다.
 * 처음 들어온 사람이 읽을 것부터 봐야 다시 온다. 웹(/)과 같은 구성이다.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import * as api from '../services/api';
import { colors } from '../theme';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Community'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: Nav;
}

const TABS: { key: api.CommunityAudience; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'tenant', label: '임차인' },
  { key: 'landlord', label: '임대인' },
  { key: 'broker', label: '중개사무소' },
];

export const ROLE_LABELS: Record<string, string> = {
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
  admin: '운영자',
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}시간 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 연재물이라 최신순으로 두면 마지막 편부터 보인다. 연재·회차 순으로 세운다. */
const episodeNo = (t: string) => Number(/(\d+)화/.exec(t)?.[1] ?? 999);

const CommunityScreen: React.FC<Props> = ({ navigation }) => {
  const [tab, setTab] = useState<api.CommunityAudience>('all');
  const [posts, setPosts] = useState<api.CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (audience: api.CommunityAudience) => {
    setError(null);
    try {
      setPosts(await api.fetchCommunityPosts(audience));
    } catch (e) {
      setError('이 게시판은 볼 수 없어요');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(tab);
    setRefreshing(false);
  }, [load, tab]);

  const { guides, threads } = useMemo(() => {
    const guides = posts
      .filter((p) => p.authorRole === 'admin')
      .sort((a, b) => {
        const bySeries = (a.category ?? '').localeCompare(b.category ?? '', 'ko');
        return bySeries !== 0 ? bySeries : episodeNo(a.title) - episodeNo(b.title);
      });
    return { guides, threads: posts.filter((p) => p.authorRole !== 'admin') };
  }, [posts]);

  const renderThread = ({ item }: { item: api.CommunityPost }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('CommunityPost', { postId: item.id })}
    >
      <View style={styles.metaRow}>
        <Text style={styles.boardTag}>
          {TABS.find((t) => t.key === item.audience)?.label ?? '전체'}
        </Text>
        <Text style={styles.author}>{item.authorName ?? '익명'}</Text>
        {ROLE_LABELS[item.authorRole] ? (
          <Text style={[styles.roleTag, item.authorRole === 'admin' && styles.roleTagAdmin]}>
            {ROLE_LABELS[item.authorRole]}
          </Text>
        ) : null}
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      <Text style={styles.rowTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.statRow}>
        <Text style={styles.stat}>댓글 {item.commentCount}</Text>
        <Text style={styles.stat}>조회 {item.viewCount}</Text>
      </View>
    </TouchableOpacity>
  );

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>입주해 커뮤니티</Text>
        <Text style={styles.heroTitle}>계약 전에 물어보는 곳</Text>
        <Text style={styles.heroSub}>
          등기부, 보증금, 특약, 세입자 확인. 혼자 판단하기 어려운 것들을
          임차인·임대인·공인중개사가 함께 봅니다.
        </Text>
      </View>

      {guides.length > 0 && (
        <View style={styles.guideSection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>입주해가 정리한 것</Text>
            <Text style={styles.sectionCount}>{guides.length}편</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.guideRow}
          >
            {guides.map((g) => (
              <TouchableOpacity
                key={g.id}
                style={styles.guideCard}
                onPress={() => navigation.navigate('CommunityPost', { postId: g.id })}
              >
                {g.category ? <Text style={styles.guideCategory}>{g.category}</Text> : null}
                <Text style={styles.guideTitle} numberOfLines={3}>
                  {g.title}
                </Text>
                <Text style={styles.guideMore}>읽기</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => {
              setTab(t.key);
              setLoading(true);
            }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={threads}
        keyExtractor={(p) => p.id}
        renderItem={renderThread}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{error ?? '아직 질문이 없어요'}</Text>
            {!error && (
              <Text style={styles.emptySub}>
                계약 전에 막히는 게 있으면 남겨주세요.{'\n'}같은 걸 겪은 사람이 답할 수 있습니다.
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loader: { marginTop: 60 },
  list: { paddingBottom: 40 },

  hero: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 22, backgroundColor: colors.surface },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: colors.primary },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.ink, marginTop: 6, letterSpacing: -0.5 },
  heroSub: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8 },

  guideSection: { paddingTop: 22 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: colors.ink },
  sectionCount: { fontSize: 12, color: colors.faint },
  guideRow: { paddingHorizontal: 20, gap: 10 },
  guideCard: {
    width: 220,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.tint,
    justifyContent: 'space-between',
  },
  guideCategory: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6, color: colors.primary },
  guideTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.ink, marginTop: 6 },
  guideMore: { fontSize: 11.5, color: colors.faint, marginTop: 14 },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surface },
  tabActive: { backgroundColor: colors.ink },
  tabText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  tabTextActive: { color: colors.background, fontWeight: '700' },

  row: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface },
  sep: { height: 1, backgroundColor: colors.line, marginLeft: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  boardTag: {
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.sunken,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  author: { fontSize: 12, color: colors.muted },
  roleTag: {
    fontSize: 11,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  roleTagAdmin: { backgroundColor: colors.primary, color: colors.white, borderColor: 'transparent' },
  time: { fontSize: 11, color: colors.faint, marginLeft: 'auto' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 21 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  stat: { fontSize: 11, color: colors.faint },

  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.muted },
  emptySub: { fontSize: 13, color: colors.faint, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});

export default CommunityScreen;
