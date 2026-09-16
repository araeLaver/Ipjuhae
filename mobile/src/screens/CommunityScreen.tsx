/**
 * Community Screen — 하나의 게시판.
 *
 * 역할별로 게시판을 쪼개지 않는다. 글이 흩어지면 어느 방에서도 대화가 안 된다.
 * 대신 글마다 글쓴이의 역할을 배지로 붙여 누가 쓴 글인지 구분한다.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
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
      // 역할 판은 그 역할만 읽을 수 있다. 권한이 없으면 목록이 아니라 안내를 보여준다.
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

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return '방금';
    if (mins < 60) return `${mins}분 전`;
    if (mins < 60 * 24) return `${Math.floor(mins / 60)}시간 전`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  const renderItem = ({ item }: { item: api.CommunityPost }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CommunityPost', { postId: item.id })}
    >
      <View style={styles.metaRow}>
        <Text style={styles.boardTag}>{TABS.find((t) => t.key === item.audience)?.label ?? '전체'}</Text>
        <Text style={styles.author}>{item.authorName ?? '익명'}</Text>
        {ROLE_LABELS[item.authorRole] ? (
          <Text style={[styles.roleTag, item.authorRole === 'admin' && styles.roleTagAdmin]}>
            {ROLE_LABELS[item.authorRole]}
          </Text>
        ) : null}
        <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.statRow}>
        <Text style={styles.stat}>댓글 {item.commentCount}</Text>
        <Text style={styles.stat}>조회 {item.viewCount}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>커뮤니티</Text>
        <Text style={styles.sub}>임차인·임대인·공인중개사가 정보를 나누는 공간</Text>
      </View>

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

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{error ?? '아직 글이 없어요'}</Text>
              {!error && <Text style={styles.emptySub}>첫 글을 남겨보세요.</Text>}
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12 },
  heading: { fontSize: 24, fontWeight: 'bold', color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.sunken },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  tabTextActive: { color: colors.white, fontWeight: '700' },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  boardTag: {
    fontSize: 11,
    color: colors.muted,
    backgroundColor: colors.sunken,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  title: { fontSize: 15, fontWeight: '600', color: colors.ink, lineHeight: 21 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  stat: { fontSize: 11, color: colors.faint },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.muted },
  emptySub: { fontSize: 13, color: colors.faint, marginTop: 6 },
});

export default CommunityScreen;
