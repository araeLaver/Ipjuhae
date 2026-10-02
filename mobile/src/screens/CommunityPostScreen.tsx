/**
 * Community Post Screen — 글 하나.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as api from '../services/api';
import { ROLE_LABELS, authorDisplayName } from '../lib/community';
import PostingConsent from '../components/PostingConsent';
import { colors } from '../theme';

const roleLabels = ROLE_LABELS as Record<string, string>;

/**
 * 역할 배지는 **운영자만** 세운다. 익명 게시판에서 일반 역할 라벨(임차인·임대인·중개사)은
 * 글쓴이의 신원 범위를 좁힌다. DOW-1176이 배지를 넣은 취지는 운영자 답을 눈에 걸리게
 * 하는 것 하나였다. (DOW-1236 UX 판정 — 웹 `AuthorRoleBadge`와 같은 규칙)
 */
const roleBadgeLabel = (role: string | null | undefined): string | null =>
  role === 'admin' ? (roleLabels[role] ?? null) : null;

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CommunityPost'>;
  route: RouteProp<RootStackParamList, 'CommunityPost'>;
}

const CommunityPostScreen: React.FC<Props> = ({ route }) => {
  const { postId } = route.params;
  const [post, setPost] = useState<api.CommunityPost | null>(null);
  const [comments, setComments] = useState<api.CommunityComment[]>([]);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postingAgreed, setPostingAgreed] = useState(false);
  const [draft, setDraft] = useState('');
  const [reportTarget, setReportTarget] = useState<{ commentId?: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async (cursor?: string) => {
    if (cursor) setMoreLoading(true);
    else setCommentsLoading(true);
    setMoreError(false);
    setCommentsError(null);
    try {
      const page = await api.fetchCommunityCommentsPage(postId, cursor);
      setComments(previous => cursor
        ? [...previous, ...page.comments.filter(c => !previous.some(p => p.id === c.id))]
        : page.comments);
      setCommentsTotal(page.total ?? page.comments.length);
      setNextCursor(page.nextCursor ?? null);
    } catch (e) {
      if (cursor) setMoreError(true);
      else { setComments([]); setCommentsError('댓글을 불러오지 못했어요'); }
    } finally {
      setCommentsLoading(false);
      setMoreLoading(false);
    }
  }, [postId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPost(await api.fetchCommunityPost(postId));
    } catch (e) {
      setPost(null);
      setError('글을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
    loadComments();
  }, [load, loadComments]);

  /**
   * 댓글을 남긴다. 로그인하지 않아도 된다 — 서버가 익명 댓글을 허용한다.
   *
   * 올린 뒤 목록을 다시 불러온다. 낙관적으로 화면에만 끼워 넣으면, 서버가
   * 거른 글(도배 한도·정화)이 내 화면에만 남아 있는 상태가 된다.
   */
  async function submitComment() {
    if (!postingAgreed) { Alert.alert('필수 동의', '게시 전 약관과 개인정보 안내에 동의해주세요.'); return; }
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      await api.createCommunityComment(postId, body);
      setDraft('');
      await loadComments();
    } catch (e) {
      Alert.alert(
        '남기지 못했어요',
        e instanceof Error && e.message ? e.message : '잠시 후 다시 시도해주세요.'
      );
    } finally {
      setPosting(false);
    }
  }

  function report(commentId?: string) {
    if (!reporting) setReportTarget(commentId ? { commentId } : {});
  }
  async function submitReport(reason: string) {
    if (!reportTarget || reporting) return;
    const target = reportTarget;
    setReportTarget(null); setReporting(true);
    try {
      const r = target.commentId
        ? await api.reportCommunityComment(target.commentId, reason)
        : await api.reportCommunityPost(postId, reason);
      Alert.alert('신고 접수', r.hidden ? '신고가 쌓여 해당 글 또는 댓글은 보이지 않게 처리됐습니다.' : '운영자가 확인합니다.');
      if (r.hidden) { if (target.commentId) await loadComments(); else await load(); }
    } catch { Alert.alert('접수하지 못했어요', '잠시 후 다시 시도해주세요.'); }
    finally { setReporting(false); }
  }

  function block(commentId?: string) {
    Alert.alert('작성자를 차단할까요?', '서로의 커뮤니티 글과 댓글을 숨깁니다. 비로그인 작성자는 계정 차단 대신 신고해주세요.', [
      { text: '취소', style: 'cancel' },
      { text: '차단', style: 'destructive', onPress: async () => {
        try { await api.blockCommunityAuthor(commentId ? { commentId } : { postId }); await load(); await loadComments(); }
        catch (e) { Alert.alert('차단하지 못했습니다', e instanceof Error ? e.message : '다시 시도해주세요.'); }
      } },
    ]);
  }

  if (loading) return <ActivityIndicator style={styles.loader} color={colors.primary} />;

  if (error || !post) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? '글을 찾을 수 없어요'}</Text>
      </View>
    );
  }

  const created = new Date(post.createdAt);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
    <Modal visible={reportTarget !== null} transparent animationType="slide" onRequestClose={() => setReportTarget(null)}>
      <View style={styles.reportModalBackdrop}>
        <View style={styles.reportModalCard}>
          <Text style={styles.commentsTitle}>신고 사유 선택</Text>
          {['개인정보 노출', '광고·스팸', '욕설·혐오', '허위 정보'].map(reason => (
            <TouchableOpacity key={reason} accessibilityRole="button" disabled={reporting} style={styles.retryBtn} onPress={() => submitReport(reason)}><Text>{reason}</Text></TouchableOpacity>
          ))}
          <TouchableOpacity accessibilityRole="button" style={styles.retryBtn} onPress={() => setReportTarget(null)}><Text>취소</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{authorDisplayName(post.authorRole)}</Text>
        {roleBadgeLabel(post.authorRole) ? (
          <Text style={[styles.roleTag, styles.roleTagAdmin]}>{roleBadgeLabel(post.authorRole)}</Text>
        ) : null}
        <Text style={styles.time}>
          {created.getMonth() + 1}월 {created.getDate()}일
        </Text>
      </View>

      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.body}>{post.body}</Text>

      {/* 댓글 수는 아래 댓글 머리글에서 한 번만 말한다. 같은 숫자를 두 줄 걸러
          두 번 두면 어느 쪽이 진짜인지 읽는 사람이 판단해야 한다. */}
      <View style={styles.statRow}>
        <Text style={styles.stat}>조회 {post.viewCount}</Text>
        <TouchableOpacity onPress={() => block()}><Text style={styles.reportText}>작성자 차단</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => report()} style={styles.reportBtn}>
          <Text style={styles.reportText}>신고</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.commentsSection}>
        <Text style={styles.commentsTitle}>{commentsError ? '댓글' : `댓글 ${commentsTotal}`}</Text>

        {/* 앱에는 입력창 자체가 없어서 읽기 전용이었다. 커뮤니티가 성립하려면
            물어본 곳에서 답이 와야 한다. 가입 없이 바로 쓴다. */}
        <View style={styles.composer}>
          <PostingConsent agreed={postingAgreed} onChange={setPostingAgreed} />
          <TextInput
            style={styles.composerInput}
            placeholder="답을 남겨주세요. 주소와 건물명은 적지 말아주세요."
            placeholderTextColor={colors.faint}
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlignVertical="top"
            maxLength={2000}
          />
          <View style={styles.composerFoot}>
            {/* 지킬 수 있는 만큼만 약속한다 — 이름은 표시되지 않지만 작성 계정은
                신고 처리를 위해 저장된다(DOW-1236). */}
            <Text style={styles.composerNote}>
              익명으로 올라갑니다. 신고 처리를 위해 작성 계정만 내부에 기록됩니다.
            </Text>
            <TouchableOpacity
              style={[styles.composerBtn, (posting || !draft.trim()) && styles.composerBtnOff]}
              onPress={submitComment}
              disabled={posting || !draft.trim()}
            >
              <Text style={styles.composerBtnText}>{posting ? '올리는 중' : '댓글 남기기'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {commentsLoading ? (
          <ActivityIndicator style={styles.commentsLoader} color={colors.primary} />
        ) : commentsError ? (
          <View style={styles.commentsState}>
            <Text style={styles.commentsStateText}>{commentsError}</Text>
            <TouchableOpacity onPress={() => loadComments()} style={styles.retryBtn}>
              <Text style={styles.retryText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.commentsState}>
            <Text style={styles.commentsStateText}>아직 댓글이 없어요</Text>
          </View>
        ) : (
          comments.map((comment) => (
            <View
              key={comment.id}
              style={[styles.commentCard, comment.authorRole === 'admin' && styles.commentCardAdmin]}
            >
              <View style={styles.commentMetaRow}>
                <Text style={styles.commentAuthor}>{authorDisplayName(comment.authorRole)}</Text>
                {roleBadgeLabel(comment.authorRole) ? (
                  <Text style={[styles.roleTag, styles.roleTagAdmin]}>{roleBadgeLabel(comment.authorRole)}</Text>
                ) : null}
              </View>
              <Text style={styles.commentBody}>{comment.body}</Text>
              <TouchableOpacity onPress={() => report(comment.id)}><Text style={styles.reportText}>댓글 신고 · 작성자 신고</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => block(comment.id)}><Text style={styles.reportText}>작성자 차단</Text></TouchableOpacity>
            </View>
          ))
        )}
        {nextCursor && !commentsError && (
          <TouchableOpacity disabled={moreLoading} onPress={() => loadComments(nextCursor)} style={styles.retryBtn}>
            <Text style={styles.retryText}>{moreLoading ? '불러오는 중…' : moreError ? '댓글 더 보기 다시 시도' : '댓글 더 보기'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  reportModalBackdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0008' },
  reportModalCard: { backgroundColor: colors.surface, borderRadius: 12, padding: 20 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  loader: { marginTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  errorText: { fontSize: 15, color: colors.muted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  author: { fontSize: 13, color: colors.muted },
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
  time: { fontSize: 12, color: colors.faint, marginLeft: 'auto' },
  title: { fontSize: 21, fontWeight: 'bold', color: colors.ink, lineHeight: 30 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 25, marginTop: 16 },
  statRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  stat: { fontSize: 12, color: colors.faint },
  reportBtn: { marginLeft: 'auto' },
  reportText: { fontSize: 12, color: colors.muted, textDecorationLine: 'underline' },
  commentsSection: { marginTop: 28 },
  commentsTitle: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  composer: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    backgroundColor: colors.surface,
  },
  composerInput: { minHeight: 72, fontSize: 14, color: colors.ink, lineHeight: 21, padding: 0 },
  composerFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  // 안내 문구가 한 줄보다 길다. flex 없이 두면 좁은 화면에서 '댓글 남기기' 버튼을 밀어낸다.
  composerNote: { flex: 1, marginRight: 10, fontSize: 12, color: colors.faint },
  composerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  composerBtnOff: { opacity: 0.4 },
  composerBtnText: { fontSize: 13, fontWeight: '800', color: colors.white },
  commentsLoader: { marginVertical: 20 },
  commentsState: {
    alignItems: 'center',
    padding: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  commentsStateText: { fontSize: 13, color: colors.muted },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.background,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  commentCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  commentCardAdmin: { borderColor: colors.primary, backgroundColor: colors.tint },
  commentMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 6, flexWrap: 'wrap' },
  commentAuthor: { fontSize: 12, color: colors.muted },
  commentBody: { fontSize: 14, color: colors.ink, lineHeight: 22 },
});

export default CommunityPostScreen;
