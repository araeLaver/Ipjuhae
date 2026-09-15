import React from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNotifications } from '../contexts/NotificationContext';
import { openNotificationSettings } from '../services/notificationService';

export default function NotificationSettingsScreen() {
  const { enabled, permission, tokenRegistered, error, isLoading, setEnabled, refresh } = useNotifications();

  const statusText = permission === 'granted'
    ? (tokenRegistered ? '알림을 받을 준비가 되었습니다.' : '기기 권한은 허용되어 있습니다.')
    : permission === 'denied'
      ? '기기 설정에서 알림 권한이 꺼져 있습니다.'
      : '알림을 켜면 기기 권한을 요청합니다.';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.title}>푸시 알림</Text>
            <Text style={styles.description}>새 메시지와 매칭 소식을 알려드립니다.</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator color="#F0663F" />
          ) : (
            <Switch
              value={enabled}
              onValueChange={(value) => void setEnabled(value)}
              trackColor={{ false: '#CFC4B8', true: '#F4977B' }}
              thumbColor={enabled ? '#F0663F' : '#F3EEE6'}
            />
          )}
        </View>
        <Text style={styles.status}>{statusText}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {permission === 'denied' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void openNotificationSettings()}>
          <Text style={styles.primaryButtonText}>기기 알림 설정 열기</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.retryButton} onPress={() => void refresh()} disabled={isLoading}>
        <Text style={styles.retryButtonText}>상태 다시 확인</Text>
      </TouchableOpacity>
      <Text style={styles.note}>알림 초기화나 토큰 등록이 실패해도 앱의 다른 기능은 계속 사용할 수 있습니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EF', padding: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18 },
  row: { flexDirection: 'row', alignItems: 'center' },
  copy: { flex: 1, paddingRight: 16 },
  title: { fontSize: 17, fontWeight: '700', color: '#262220' },
  description: { marginTop: 5, fontSize: 14, lineHeight: 20, color: '#6B625C' },
  status: { marginTop: 16, fontSize: 13, color: '#4A423C' },
  error: { marginTop: 8, fontSize: 13, lineHeight: 19, color: '#B45309' },
  primaryButton: { marginTop: 16, borderRadius: 10, backgroundColor: '#F0663F', padding: 14 },
  primaryButtonText: { color: '#FFFFFF', textAlign: 'center', fontWeight: '700' },
  retryButton: { marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: '#CFC4B8', padding: 13 },
  retryButtonText: { color: '#4A423C', textAlign: 'center', fontWeight: '600' },
  note: { marginTop: 18, fontSize: 12, lineHeight: 18, color: '#9A8F87' },
});
