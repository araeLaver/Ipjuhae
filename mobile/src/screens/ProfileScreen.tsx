/**
 * Profile Screen — tenant profile dashboard or landlord profile
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import { TenantProfile, VerificationStatus } from '../types';

type ProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: ProfileScreenNavigationProp;
}

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [verifications, setVerifications] = useState<VerificationStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    try {
      if (user?.userType === 'tenant') {
        // /api/profile → { profile } (snake_case); /api/verifications → { verification }
        const [prof, verif] = await Promise.all([
          api.fetchTenantProfile(),
          api.fetchVerificationStatus(),
        ]);
        setProfile(prof);
        setVerifications(verif);
      }
      hasLoadedRef.current = true;
      setLoadError(null);
    } catch (error) {
      console.log('Failed to load profile:', error);
      setLoadError('프로필을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [user?.userType]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: logout },
    ]);
  };

  const getTrustGrade = (score: number) => {
    if (score >= 80) return { label: '우수', color: '#3F7A5E' };
    if (score >= 60) return { label: '양호', color: '#C2451F' };
    if (score >= 40) return { label: '보통', color: '#F59E0B' };
    return { label: '시작', color: '#9A8F87' };
  };

  const isTenant = user?.userType === 'tenant';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F0663F" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {loadError && (
        <View style={styles.loadErrorBanner}>
          <Text style={styles.loadErrorTitle}>프로필을 불러오지 못했습니다</Text>
          <Text style={styles.loadErrorSubtitle}>
            프로필이 비어 있는 상태가 아니라 조회에 실패했습니다.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        {user?.profileImage ? (
          <Image source={{ uri: user.profileImage }} style={styles.profileImage} />
        ) : (
          <View style={styles.profileImagePlaceholder}>
            <Text style={styles.profileInitial}>{user?.name?.[0] || 'U'}</Text>
          </View>
        )}
        <Text style={styles.name}>{user?.name || '사용자'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>
            {isTenant ? '세입자' : '집주인'}
          </Text>
        </View>
      </View>

      {/* Trust Score (Tenant) */}
      {isTenant && profile && (
        <View style={styles.trustSection}>
          <View style={styles.trustHeader}>
            <Text style={styles.trustTitle}>신뢰 점수</Text>
            <View style={[styles.gradeBadge, { backgroundColor: getTrustGrade(profile.trustScore).color + '20' }]}>
              <Text style={[styles.gradeText, { color: getTrustGrade(profile.trustScore).color }]}>
                {getTrustGrade(profile.trustScore).label}
              </Text>
            </View>
          </View>
          <Text style={styles.trustScoreValue}>{profile.trustScore}점</Text>
          <View style={styles.trustBar}>
            <View style={[styles.trustFill, { width: `${Math.min(profile.trustScore, 100)}%` }]} />
          </View>
        </View>
      )}

      {/* Verification Status (Tenant) */}
      {isTenant && verifications && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>인증 현황</Text>
          <VerifItem label="재직 인증" done={verifications.employmentVerified} />
          <VerifItem label="소득 인증" done={verifications.incomeVerified} />
          <VerifItem label="신용 인증" done={verifications.creditVerified} />
          <TouchableOpacity
            style={styles.verifButton}
            onPress={() => navigation.navigate('Verification')}
          >
            <Text style={styles.verifButtonText}>인증 관리</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>설정</Text>
        <MenuItem icon="✏️" label="프로필 편집" onPress={() => navigation.navigate('ProfileEdit')} />
        {isTenant && (
          <MenuItem icon="📄" label="레퍼런스 관리" onPress={() => navigation.navigate('References')} />
        )}
        <MenuItem icon="🔔" label="알림 설정" onPress={() => navigation.navigate('NotificationSettings')} />
        <MenuItem icon="⚙️" label="앱 설정" onPress={() => navigation.navigate('Settings')} />
      </View>

      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>입주해 v1.0.0</Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const VerifItem: React.FC<{ label: string; done: boolean }> = ({ label, done }) => (
  <View style={styles.verifItem}>
    <Text style={styles.verifLabel}>{label}</Text>
    <Text style={[styles.verifStatus, done && styles.verifDone]}>
      {done ? '완료' : '미인증'}
    </Text>
  </View>
);

const MenuItem: React.FC<{ icon: string; label: string; onPress: () => void }> = ({
  icon,
  label,
  onPress,
}) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Text style={styles.menuIcon}>{icon}</Text>
    <Text style={styles.menuText}>{label}</Text>
    <Text style={styles.menuArrow}>›</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF6EF' },
  header: {
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E7DFD4',
  },
  profileImage: { width: 80, height: 80, borderRadius: 40 },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0663F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#262220', marginTop: 12 },
  email: { fontSize: 14, color: '#6B625C', marginTop: 2 },
  typeBadge: { backgroundColor: '#FFF3DC', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 8 },
  typeText: { fontSize: 12, color: '#C2451F', fontWeight: '600' },
  trustSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
  },
  trustHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trustTitle: { fontSize: 16, fontWeight: '600', color: '#4A423C' },
  gradeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  gradeText: { fontSize: 13, fontWeight: '600' },
  trustScoreValue: { fontSize: 36, fontWeight: 'bold', color: '#C2451F', marginTop: 8 },
  trustBar: { height: 8, backgroundColor: '#E7DFD4', borderRadius: 4, marginTop: 12 },
  trustFill: { height: 8, backgroundColor: '#F0663F', borderRadius: 4 },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#4A423C', marginBottom: 12 },
  verifItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 6,
  },
  verifLabel: { fontSize: 15, color: '#262220' },
  verifStatus: { fontSize: 14, color: '#9A8F87' },
  verifDone: { color: '#3F7A5E', fontWeight: '600' },
  verifButton: {
    backgroundColor: '#F0663F',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  verifButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 6,
  },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuText: { flex: 1, fontSize: 16, color: '#262220' },
  menuArrow: { fontSize: 20, color: '#9A8F87' },
  logoutSection: { marginTop: 32, alignItems: 'center', paddingHorizontal: 24 },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: '#C0392B' },
  versionText: { fontSize: 12, color: '#9A8F87', marginTop: 16 },
  bottomPadding: { height: 48 },
  loadErrorBanner: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFF3DC',
    borderWidth: 1,
    borderColor: '#F4977B',
    alignItems: 'center',
  },
  loadErrorTitle: { fontSize: 16, fontWeight: '600', color: '#4A423C' },
  loadErrorSubtitle: { fontSize: 14, color: '#9A8F87', marginTop: 4, textAlign: 'center' },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0663F',
  },
  retryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default ProfileScreen;
