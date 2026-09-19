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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPost(await api.fetchCommunityPost(postId));
    } catch (e) {
      setError('글을 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

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
        <Text style={styles.stat}>댓글 {post.commentCount}</Text>
        <Text style={styles.stat}>조회 {post.viewCount}</Text>
        <TouchableOpacity onPress={report} style={styles.reportBtn}>
          <Text style={styles.reportText}>신고</Text>
        </TouchableOpacity>
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
});

export default CommunityPostScreen;
