/**
 * Community Post Screen — 글 하나.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import * as api from '../services/api';
import { colors } from '../theme';
import { ROLE_LABELS } from './CommunityScreen';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CommunityPost'>;
  route: RouteProp<RootStackParamList, 'CommunityPost'>;
}

const CommunityPostScreen: React.FC<Props> = ({ route }) => {
  const { postId } = route.params;
  const [post, setPost] = useState<api.CommunityPost | null>(null);
  const [comments, setComments] = useState<api.CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsError(null);
    try {
      setComments(await api.fetchCommunityComments(postId));
    } catch (e) {
      setComments([]);
      setCommentsError('댓글을 불러오지 못했어요');
    } finally {
      setCommentsLoading(false);
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

  function report() {
    Alert.alert('이 글을 신고할까요?', '사유를 골라주세요.', [
      { text: '취소', style: 'cancel' },
      ...['개인정보 노출', '광고·스팸', '욕설·혐오', '허위 정보'].map((reason) => ({
        text: reason,
        onPress: async () => {
          try {
            const r = await api.reportCommunityPost(postId, reason);
            Alert.alert(
              '신고 접수',
              r.hidden
                ? '신고가 쌓여 이 글은 보이지 않게 처리됐습니다.'
                : '운영자가 확인합니다.'
            );
          } catch {
            Alert.alert('접수하지 못했어요', '잠시 후 다시 시도해주세요.');
          }
        },
      })),
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.metaRow}>
        <Text style={styles.author}>{post.authorName ?? '익명'}</Text>
        {ROLE_LABELS[post.authorRole] ? (
          <Text style={[styles.roleTag, post.authorRole === 'admin' && styles.roleTagAdmin]}>
            {ROLE_LABELS[post.authorRole]}
          </Text>
        ) : null}
        <Text style={styles.time}>
          {created.getMonth() + 1}월 {created.getDate()}일
        </Text>
      </View>

      <Text style={styles.title}>{post.title}</Text>
      <Text style={styles.body}>{post.body}</Text>

      <View style={styles.statRow}>
        <Text style={styles.stat}>{commentsError ? '댓글' : `댓글 ${comments.length}`}</Text>
        <Text style={styles.stat}>조회 {post.viewCount}</Text>
        <TouchableOpacity onPress={report} style={styles.reportBtn}>
          <Text style={styles.reportText}>신고</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.commentsSection}>
        <Text style={styles.commentsTitle}>{commentsError ? '댓글' : `댓글 ${comments.length}`}</Text>

        {commentsLoading ? (
          <ActivityIndicator style={styles.commentsLoader} color={colors.primary} />
        ) : commentsError ? (
          <View style={styles.commentsState}>
            <Text style={styles.commentsStateText}>{commentsError}</Text>
            <TouchableOpacity onPress={loadComments} style={styles.retryBtn}>
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
                <Text style={styles.commentAuthor}>{comment.authorName ?? '익명'}</Text>
                {comment.authorRole && ROLE_LABELS[comment.authorRole] ? (
                  <Text style={[styles.roleTag, comment.authorRole === 'admin' && styles.roleTagAdmin]}>
                    {ROLE_LABELS[comment.authorRole]}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.commentBody}>{comment.body}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
