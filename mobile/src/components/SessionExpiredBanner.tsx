/**
 * 세션이 끊겨 비인증 상태로 돌아왔을 때 띄우는 안내 배너.
 *
 * 왜 배너인가: 401은 사용자가 무언가를 누른 직후가 아니라 아무 때나 온다.
 * 그 순간 화면만 로그인 스택으로 바뀌면 "왜 갑자기 로그아웃됐지"만 남는다.
 * 무슨 일이 있었는지 한 줄로 남겨야 다시 로그인할 이유가 설명된다.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

const SessionExpiredBanner: React.FC = () => {
  const { sessionExpiredMessage, dismissSessionExpired } = useAuth();

  if (!sessionExpiredMessage) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.message}>{sessionExpiredMessage}</Text>
      <TouchableOpacity onPress={dismissSessionExpired} accessibilityLabel="안내 닫기">
        <Text style={styles.dismiss}>닫기</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDEBE4',
    borderBottomWidth: 1,
    borderBottomColor: '#F0663F',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  message: { flex: 1, color: '#8A2E12', fontSize: 14 },
  dismiss: { color: '#C2451F', fontSize: 14, fontWeight: '600', marginLeft: 12 },
});

export default SessionExpiredBanner;
