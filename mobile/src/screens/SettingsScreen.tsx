/**
 * Settings Screen — app preferences and account management
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import Constants from 'expo-constants';
import * as api from '../services/api';

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
  const [deleting, setDeleting] = React.useState(false);

  const handleLogout = () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', onPress: logout, style: 'destructive' },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '계정 삭제',
      '계정을 삭제하면 프로필과 인증 자료가 지워지고 등록한 매물은 비공개로 전환됩니다.\n되돌릴 수 없습니다. 계속하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              await api.deleteAccount();
              // 서버가 계정을 지운 뒤에는 남은 토큰이 의미가 없다. 바로 로그아웃 상태로 보낸다.
              await logout();
            } catch (e) {
              Alert.alert(
                '삭제하지 못했습니다',
                '잠시 후 다시 시도해 주세요. 계속 안 되면 support@ipjuhae.com 으로 알려주세요.'
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: '알림',
      items: [
        { icon: '🔔', label: '푸시 알림 설정', type: 'link', onPress: () => navigation.navigate('NotificationSettings') },
      ],
    },
    {
      title: '계정',
      items: [
        { icon: '✏️', label: '프로필 편집', type: 'link', onPress: () => navigation.navigate('ProfileEdit') },
        { icon: '🔒', label: '비밀번호 변경', type: 'link', onPress: () => Alert.alert('안내', '비밀번호 변경은 웹에서 가능합니다.') },
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
        { icon: '⚠️', label: deleting ? '삭제하는 중…' : '계정 삭제', type: 'action', onPress: handleDeleteAccount, danger: true },
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
  container: { flex: 1, backgroundColor: '#FBF6EF' },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B625C', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  settingIcon: { fontSize: 18, marginRight: 12 },
  settingLabel: { flex: 1, fontSize: 15, color: '#262220' },
  dangerText: { color: '#C0392B' },
  chevron: { fontSize: 20, color: '#CFC4B8', fontWeight: '300' },
  divider: { height: 1, backgroundColor: '#F3EEE6', marginLeft: 46 },
  versionText: { textAlign: 'center', fontSize: 12, color: '#CFC4B8', marginTop: 20 },
});

export default SettingsScreen;
