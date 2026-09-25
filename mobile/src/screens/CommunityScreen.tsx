/**
 * Community Screen.
 *
 * 게시판을 역할별로 쪼개지 않는다. 글이 흩어지면 어느 방에서도 대화가 안 된다.
 * 대신 글마다 글쓴이의 역할을 배지로 붙여 누가 쓴 글인지 구분한다.
 *
 * 운영자가 정리한 글은 목록에 섞지 않고 위에 따로 세운다.
 * 처음 들어온 사람이 읽을 것부터 봐야 다시 온다. 웹(/)과 같은 구성이다.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import * as api from '../services/api';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';
import {
  AUDIENCE_LABELS,
  ROLE_LABELS,
  canPostTo,
  defaultAudienceFor,
  readableAudiences,
  type CommunityAudience,
} from '../lib/community';
import { colors } from '../theme';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Community'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: Nav;
}

export { ROLE_LABELS };

const roleLabels = ROLE_LABELS as Record<string, string>;

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
  const { user } = useAuth();
  const userType = user?.userType ?? null;

  const [tab, setTab] = useState<CommunityAudience>('all');
  const [posts, setPosts] = useState<api.CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 권한 때문에 막힌 것인가. 그렇다면 "다시 시도"를 권하지 않는다. */
  const [forbidden, setForbidden] = useState(false);
  const [writing, setWriting] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [audience, setAudience] = useState<CommunityAudience>('all');
  /** 사용자가 대상 게시판을 직접 골랐는가. 골랐다면 탭을 바꿔도 덮어쓰지 않는다. */
  const [audiencePicked, setAudiencePicked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 연재별 펼침 여부. 18편을 한 번에 세우면 게시판이 화면 밖으로 밀린다. */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // 웹과 같은 판정으로 읽을 수 있는 판만 세운다(`lib/community.ts`).
  // 4탭을 고정으로 보여주고 누르면 막던 때에는, 읽을 수 없는 판이 있다는 걸
  // 눌러 봐야만 알 수 있었다.
  const tabs = useMemo(() => readableAudiences(userType), [userType]);

  // 로그아웃 등으로 보던 탭을 더는 읽을 수 없게 되면 공용 판으로 내린다.
  // 안 그러면 사라진 탭이 계속 선택된 채 남아 목록이 비어 보인다.
  useEffect(() => {
    if (!tabs.includes(tab)) setTab('all');
  }, [tabs, tab]);

  const load = useCallback(async (aud: CommunityAudience) => {
    setError(null);
    setForbidden(false);
    try {
      setPosts(await api.fetchCommunityPosts(aud));
    } catch (e) {
      // 권한(403)과 그 밖의 실패를 갈라 말한다. `catch` 하나로 전부
      // `이 게시판은 볼 수 없어요`로 덮으면 비행기 모드·서버 500까지
      // "볼 수 없는 게시판"으로 읽힌다.
      const denied = e instanceof ApiError && e.status === 403;
      setForbidden(denied);
      setError(
        denied
          ? '이 게시판은 볼 수 없어요'
          : e instanceof Error && e.message
            ? e.message
            : '게시글을 불러오지 못했어요'
      );
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

  const { guideSeries, guideCount, threads } = useMemo(() => {
    const guides = posts.filter((p) => p.authorRole === 'admin');
    const bySeries = new Map<string, api.CommunityPost[]>();
    for (const g of guides) {
      const key = g.category ?? '안내';
      if (!bySeries.has(key)) bySeries.set(key, []);
      bySeries.get(key)!.push(g);
    }
    for (const list of bySeries.values()) list.sort((a, b) => episodeNo(a.title) - episodeNo(b.title));
    return {
      guideSeries: [...bySeries.entries()],
      guideCount: guides.length,
      threads: posts.filter((p) => p.authorRole !== 'admin'),
    };
  }, [posts]);

  /** 회차 번호를 떼고 제목만 남긴다. 목록에서는 연재명이 이미 머리에 있다. */
  const shortTitle = (t: string) => t.replace(/^.*?(\d+)화\.\s*/, '');

  /** 글쓰기 진입점은 전부 이 함수 하나를 부른다. 어디서 열었든 대상이 같아야 한다. */
  const openWriting = useCallback(() => {
    setAudience(defaultAudienceFor(tab, userType));
    setAudiencePicked(false);
    setWriting(true);
  }, [tab, userType]);

  // 폼이 열려 있는 동안 탭을 바꾸면 대상도 따라간다.
  // 단 사용자가 대상 버튼을 직접 누른 뒤에는 그 선택을 덮어쓰지 않는다.
  useEffect(() => {
    if (!writing || audiencePicked) return;
    setAudience(defaultAudienceFor(tab, userType));
  }, [writing, audiencePicked, tab, userType]);

  /** 대상 게시판을 직접 고를 수 있는 사람인가. 고를 판이 둘 이상일 때만 보인다. */
  const postableAudiences = useMemo(
    () => (userType ? tabs.filter((a) => canPostTo(userType, a)) : []),
    [tabs, userType]
  );

  async function submitPost() {
    if (!draftTitle.trim() || !draftBody.trim() || submitting) return;
    setSubmitting(true);
    try {
      // 로그인하지 않아도 쓴다. 비로그인 글은 공용 판으로만 간다.
      await api.createCommunityPost({ audience, title: draftTitle, body: draftBody });
      setDraftTitle('');
      setDraftBody('');
      setWriting(false);
      setTab(audience);
      await load(audience);
    } catch (e) {
      Alert.alert('올리지 못했어요', e instanceof Error && e.message ? e.message : '잠시 후 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  const renderThread = ({ item }: { item: api.CommunityPost }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('CommunityPost', { postId: item.id })}
    >
      <View style={styles.metaRow}>
        <Text style={styles.boardTag}>{AUDIENCE_LABELS[item.audience] ?? '전체'}</Text>
        <Text style={styles.author}>{item.authorName ?? '익명'}</Text>
        {roleLabels[item.authorRole] ? (
          <Text style={[styles.roleTag, item.authorRole === 'admin' && styles.roleTagAdmin]}>
            {roleLabels[item.authorRole]}
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

      <View style={styles.askCard}>
        <Text style={styles.askTitle}>이 집, 계약해도 될까요?</Text>
        <Text style={styles.askSub}>
          지역과 보증금, 등기부에서 본 것만 적어주시면 같이 봅니다.
          주소와 건물명은 적지 말아주세요.
        </Text>
        <TouchableOpacity style={styles.askInput} onPress={openWriting}>
          <Text style={styles.askInputText}>지금 막히는 게 무엇인가요</Text>
        </TouchableOpacity>
        <Text style={styles.askNote}>운영자가 직접 답합니다. 가입하지 않아도 익명으로 쓸 수 있어요.</Text>
      </View>

      {guideCount > 0 && (
        <View style={styles.guideSection}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>입주해가 정리한 것</Text>
            <Text style={styles.sectionCount}>{guideCount}편</Text>
          </View>
          <Text style={styles.sectionSub}>계약 전에 확인할 것을 순서대로 정리했습니다.</Text>

          {guideSeries.map(([series, list]) => {
            const open = expanded[series] ?? false;
            const shown = open ? list : list.slice(0, 4);
            return (
              <View key={series} style={styles.seriesBox}>
                <View style={styles.seriesHead}>
                  <Text style={styles.seriesName}>{series}</Text>
                  <Text style={styles.seriesCount}>{list.length}편</Text>
                </View>
                {shown.map((g, i) => (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.guideRowItem, i > 0 && styles.guideRowBorder]}
                    onPress={() => navigation.navigate('CommunityPost', { postId: g.id })}
                  >
                    <Text style={styles.guideNo}>{list.indexOf(g) + 1}</Text>
                    <Text style={styles.guideRowTitle} numberOfLines={1}>
                      {shortTitle(g.title)}
                    </Text>
                  </TouchableOpacity>
                ))}
                {list.length > 4 && (
                  <TouchableOpacity
                    style={styles.moreRow}
                    onPress={() => setExpanded((prev) => ({ ...prev, [series]: !open }))}
                  >
                    <Text style={styles.moreText}>{open ? '접기' : `${list.length}편 모두 보기`}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.tabs}>
        {tabs.map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => {
              setTab(key);
              setLoading(true);
            }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {AUDIENCE_LABELS[key]}
            </Text>
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

  const composer = (
    <Modal visible={writing} animationType="slide" onRequestClose={() => setWriting(false)}>
      <KeyboardAvoidingView
        style={styles.modal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalHead}>
          <TouchableOpacity onPress={() => setWriting(false)}>
            <Text style={styles.modalCancel}>취소</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>질문 남기기</Text>
          <TouchableOpacity onPress={submitPost} disabled={submitting || !draftTitle.trim() || !draftBody.trim()}>
            <Text
              style={[
                styles.modalSubmit,
                (submitting || !draftTitle.trim() || !draftBody.trim()) && styles.modalSubmitOff,
              ]}
            >
              {submitting ? '올리는 중' : '올리기'}
            </Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.modalTitleInput}
          placeholder="제목"
          placeholderTextColor={colors.faint}
          value={draftTitle}
          onChangeText={setDraftTitle}
          maxLength={200}
        />
        <TextInput
          style={styles.modalBodyInput}
          placeholder="어떤 상황인지 적어주세요. 지역은 동까지만, 주소와 건물명은 적지 말아주세요."
          placeholderTextColor={colors.faint}
          value={draftBody}
          onChangeText={setDraftBody}
          multiline
          textAlignVertical="top"
          maxLength={10000}
        />

        {/* 어디에 올라가는지 모른 채 올리기를 누르는 상태를 없앤다.
            선택 버튼은 권한 있는 사용자에게만 보이지만, 대상 문구는 비로그인 포함 전원에게 보인다.
            (웹 `community-board.tsx`와 같은 규칙) */}
        <View style={styles.audienceBox}>
          {postableAudiences.length > 1 && (
            <View style={styles.audienceRow}>
              {postableAudiences.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.audienceChip, audience === a && styles.audienceChipOn]}
                  onPress={() => {
                    setAudience(a);
                    setAudiencePicked(true);
                  }}
                >
                  <Text style={[styles.audienceChipText, audience === a && styles.audienceChipTextOn]}>
                    {AUDIENCE_LABELS[a]} 게시판
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={styles.audienceNote}>
            <Text style={styles.audienceNoteStrong}>{AUDIENCE_LABELS[audience]} 게시판</Text>에
            올라갑니다.
          </Text>
        </View>

        <Text style={styles.modalNote}>익명으로 올라갑니다.</Text>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {composer}
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
            {/* 권한으로 막힌 판은 다시 눌러도 같으므로 재시도를 권하지 않는다. */}
            {error && !forbidden && (
              <TouchableOpacity style={styles.retryBtn} onPress={() => load(tab)}>
                <Text style={styles.retryText}>다시 시도</Text>
              </TouchableOpacity>
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

  askCard: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 18,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.tint,
  },
  askTitle: { fontSize: 16, fontWeight: '900', color: colors.ink },
  askSub: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 6 },
  askInput: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
  },
  askInputText: { fontSize: 13.5, color: colors.faint },
  askNote: { fontSize: 11.5, color: colors.muted, marginTop: 10 },

  guideSection: { paddingTop: 26 },
  sectionSub: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, marginBottom: 14 },
  seriesBox: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  seriesHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: colors.sunken,
  },
  seriesName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  seriesCount: { fontSize: 11.5, color: colors.muted },
  guideRowItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  moreRow: { paddingVertical: 11, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line },
  moreText: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  guideRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  guideNo: { width: 18, fontSize: 13, fontWeight: '700', color: colors.primary },
  guideRowTitle: { flex: 1, fontSize: 13.5, fontWeight: '500', color: colors.ink, lineHeight: 19 },
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

  modal: { flex: 1, backgroundColor: colors.background },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
  },
  modalCancel: { fontSize: 15, color: colors.muted },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  modalSubmit: { fontSize: 15, fontWeight: '700', color: colors.primaryInk },
  modalSubmitOff: { color: colors.faint },
  modalTitleInput: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalBodyInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
    color: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
  },
  modalNote: {
    fontSize: 12,
    color: colors.muted,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  audienceBox: { paddingHorizontal: 20, paddingTop: 14, gap: 8 },
  audienceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  audienceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.tint,
  },
  audienceChipOn: { backgroundColor: colors.primary },
  audienceChipText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  audienceChipTextOn: { color: colors.white },
  audienceNote: { fontSize: 12, color: colors.muted },
  audienceNoteStrong: { fontWeight: '800', color: colors.ink },

  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.muted },
  emptySub: { fontSize: 13, color: colors.faint, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.ink },
});

export default CommunityScreen;
