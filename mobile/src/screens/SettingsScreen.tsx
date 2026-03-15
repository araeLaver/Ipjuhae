/**
 * Settings Screen — app preferences and account management
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface Props {
  navigation: SettingsScreenNavigationProp;
}

interface SettingItem {
  icon: string;
  label: string;
  type: 'toggle' | 'link' | 'action';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { logout } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [messageAlert, setMessageAlert] = useState(true);
  const [matchAlert, setMatchAlert] = useState(true);

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', onPress: logout, style: 'destructive' },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            Alert.alert('안내', '계정 삭제를 원하시면 고객센터로 연락해주세요.\nsupport@ipjuhae.com');
          },
        },
      ]
    );
  };

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: '알림',
      items: [
        { icon: '🔔', label: '푸시 알림', type: 'toggle', value: pushEnabled, onToggle: setPushEnabled },
        { icon: '💬', label: '새 메시지 알림', type: 'toggle', value: messageAlert, onToggle: setMessageAlert },
        { icon: '🤝', label: '매칭 알림', type: 'toggle', value: matchAlert, onToggle: setMatchAlert },
      ],
    },
    {
      title: '계정',
      items: [
        { icon: '✏️', label: '프로필 편집', type: 'link', onPress: () => navigation.navigate('ProfileEdit') },
        { icon: '🔒', label: '비밀번호 변경', type: 'link', onPress: () => Alert.alert('안내', '비밀번호 변경은 웹에서 가능합니다.') },
        { icon: '📱', label: '알림 설정', type: 'link', onPress: () => navigation.navigate('NotificationSettings') },
      ],
    },
    {
      title: '정보',
      items: [
        { icon: '📋', label: '이용약관', type: 'link', onPress: () => Linking.openURL('https://www.ipjuhae.com/terms') },
        { icon: '🔐', label: '개인정보처리방침', type: 'link', onPress: () => Linking.openURL('https://www.ipjuhae.com/privacy') },
        { icon: '📧', label: '고객센터', type: 'link', onPress: () => Linking.openURL('mailto:support@ipjuhae.com') },
      ],
    },
    {
      title: '',
      items: [
        { icon: '🚪', label: '로그아웃', type: 'action', onPress: handleLogout, danger: true },
        { icon: '⚠️', label: '계정 삭제', type: 'action', onPress: handleDeleteAccount, danger: true },
      ],
    },
  ];

  const renderItem = (item: SettingItem) => (
    <TouchableOpacity
      key={item.label}
      style={styles.settingRow}
      onPress={item.type === 'toggle' ? undefined : item.onPress}
      disabled={item.type === 'toggle'}
    >
      <Text style={styles.settingIcon}>{item.icon}</Text>
      <Text style={[styles.settingLabel, item.danger && styles.dangerText]}>{item.label}</Text>
      {item.type === 'toggle' && (
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
          thumbColor={item.value ? '#2563EB' : '#F3F4F6'}
        />
      )}
      {item.type === 'link' && <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {sections.map((section, sIdx) => (
        <View key={sIdx} style={styles.section}>
          {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
          <View style={styles.sectionCard}>
            {section.items.map((item, iIdx) => (
              <View key={item.label}>
                {renderItem(item)}
                {iIdx < section.items.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.versionText}>
        입주해 v{Constants.expoConfig?.version || '1.0.0'}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  settingIcon: { fontSize: 18, marginRight: 12 },
  settingLabel: { flex: 1, fontSize: 15, color: '#111827' },
  dangerText: { color: '#DC2626' },
  chevron: { fontSize: 20, color: '#D1D5DB', fontWeight: '300' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginLeft: 46 },
  versionText: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: 20 },
});

export default SettingsScreen;
