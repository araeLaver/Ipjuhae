import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiClient } from '../services/apiClient';

interface MobilePreferences {
  pushEnabled: boolean;
  messageEnabled: boolean;
  matchEnabled: boolean;
}

interface PreferencesResponse {
  mobile: MobilePreferences;
}

const DEFAULTS: MobilePreferences = {
  pushEnabled: true,
  messageEnabled: true,
  matchEnabled: true,
};

export default function NotificationSettingsScreen() {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [permission, setPermission] = useState<Notifications.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refreshPermission = useCallback(async () => {
    const result = await Notifications.getPermissionsAsync();
    setPermission(result.status);
  }, []);

  const load = useCallback(async () => {
    try {
      const [response] = await Promise.all([
        apiClient.get<PreferencesResponse>('/notifications/preferences'),
        refreshPermission(),
      ]);
      setPreferences(response.mobile);
    } catch {
      Alert.alert('오류', '알림 설정을 불러오지 못했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }, [refreshPermission]);

  useEffect(() => {
    load();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshPermission();
    });
    return () => subscription.remove();
  }, [load, refreshPermission]);

  const save = async (next: MobilePreferences) => {
    const previous = preferences;
    setPreferences(next);
    setSaving(true);
    try {
      await apiClient.put('/notifications/preferences', { mobile: next });
    } catch {
      setPreferences(previous);
      Alert.alert('저장 실패', '알림 설정을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async (enabled: boolean) => {
    if (enabled && permission !== Notifications.PermissionStatus.GRANTED) {
      const result = await Notifications.requestPermissionsAsync();
      setPermission(result.status);
      if (result.status !== Notifications.PermissionStatus.GRANTED) {
        Alert.alert(
          '알림 권한이 필요합니다',
          '기기 설정에서 입주해의 알림 권한을 허용해주세요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }
    await save({ ...preferences, pushEnabled: enabled });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#B95545" /></View>;
  }

  const rows = [
    { label: '푸시 알림', detail: '기기의 알림 권한과 함께 사용합니다.', value: preferences.pushEnabled, onChange: togglePush },
    { label: '새 메시지 알림', detail: '새로운 대화와 메시지를 알려드립니다.', value: preferences.messageEnabled, onChange: (value: boolean) => save({ ...preferences, messageEnabled: value }) },
    { label: '매칭 알림', detail: '새로운 매칭 결과를 알려드립니다.', value: preferences.matchEnabled, onChange: (value: boolean) => save({ ...preferences, matchEnabled: value }) },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {permission !== Notifications.PermissionStatus.GRANTED && (
        <Text style={styles.warning}>현재 기기 알림 권한이 꺼져 있습니다. 푸시 알림을 켜면 권한을 요청합니다.</Text>
      )}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index > 0 && styles.divider]}>
            <View style={styles.copy}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.detail}>{row.detail}</Text>
            </View>
            <Switch value={row.value} onValueChange={row.onChange} disabled={saving} />
          </View>
        ))}
      </View>
      {saving && <Text style={styles.saving}>저장 중...</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5EF' },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F5EF' },
  warning: { color: '#92400E', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 10, marginBottom: 12, lineHeight: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  copy: { flex: 1, paddingRight: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#2A211F' },
  detail: { fontSize: 13, color: '#7A5E55', marginTop: 4 },
  saving: { textAlign: 'center', color: '#7A5E55', marginTop: 12 },
});
