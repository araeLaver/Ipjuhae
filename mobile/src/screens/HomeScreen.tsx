/**
 * Home Dashboard Screen
 *
 * 역할별로 다른 홈을 보여준다. `tenant`/`landlord`에는 각자의 대시보드를,
 * 그 밖의 역할(`broker`·`admin`)에는 **지금 앱에서 실제로 할 수 있는 것**
 * (커뮤니티·메시지·프로필)만 안내한다. 없는 기능을 있는 척하지 않으려고
 * 빈 집주인 대시보드로 떨어뜨리지 않는다. (DOW-1197 C2)
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_LABELS } from '../lib/roles';
import * as api from '../services/api';
import { DashboardStats } from '../types';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

/** 홈이 보여줄 화면 종류. `other`는 앱에 전용 대시보드가 아직 없는 역할(`broker`·`admin`). */
type HomeVariant = 'tenant' | 'landlord' | 'other';

export function homeVariantFor(userType: string | null | undefined): HomeVariant {
  if (userType === 'tenant') return 'tenant';
  if (userType === 'landlord') return 'landlord';
  return 'other';
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [trustScore, setTrustScore] = useState(0);
  const [profileComplete, setProfileComplete] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const variant = homeVariantFor(user?.userType);

  const loadData = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    try {
      if (variant === 'tenant') {
        const profile = await api.fetchTenantProfile();
        setTrustScore(profile?.trustScore ?? 0);
        setProfileComplete(profile?.isComplete ?? false);
      } else if (variant === 'landlord') {
        setStats(await api.fetchLandlordStats());
      }
      hasLoadedRef.current = true;
      setLoadError(null);
    } catch (error) {
      console.log('Failed to load home data:', error);
      setLoadError('홈 정보를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [variant]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const isTenant = variant === 'tenant';
  const roleLabel = user?.userType ? ROLE_LABELS[user.userType] : null;

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
          <Text style={styles.loadErrorTitle}>홈 정보를 불러오지 못했습니다</Text>
          <Text style={styles.loadErrorSubtitle}>
            신뢰 점수와 통계가 없는 상태가 아니라 조회에 실패했습니다.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Welcome */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          안녕하세요, {user?.name || '회원'}님!
        </Text>
        <Text style={styles.welcomeSubtext}>
          {variant === 'tenant'
            ? '나에게 맞는 집을 찾아보세요'
            : variant === 'landlord'
              ? '매물을 관리하고 세입자를 만나보세요'
              : '커뮤니티와 프로필을 이용해 보세요'}
        </Text>
      </View>

      {/* Tenant: Trust Score */}
      {isTenant && (
        <TouchableOpacity
          style={styles.trustCard}
          onPress={() => navigation.navigate('Profile' as any)}
        >
          <View style={styles.trustHeader}>
            <Text style={styles.trustTitle}>신뢰 점수</Text>
            <Text style={styles.trustScore}>{trustScore}</Text>
          </View>
          <View style={styles.trustBar}>
            <View style={[styles.trustFill, { width: `${Math.min(trustScore, 100)}%` }]} />
          </View>
          {!profileComplete && (
            <Text style={styles.trustHint}>프로필을 완성하면 점수가 올라갑니다</Text>
          )}
        </TouchableOpacity>
      )}

      {/* broker·admin: 앱에 전용 대시보드가 아직 없다는 사실을 그대로 말한다 */}
      {variant === 'other' && (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>앱 전용 화면은 아직 준비 중입니다</Text>
          <Text style={styles.noticeBody}>
            {roleLabel ?? '이 역할'} 계정의 매물·고객 관리 기능은 웹에서 이용해 주세요. 앱에서는
            커뮤니티와 메시지, 프로필을 바로 쓸 수 있습니다.
          </Text>
        </View>
      )}

      {/* Landlord: Stats */}
      {variant === 'landlord' && stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.propertyCount}</Text>
            <Text style={styles.statLabel}>매물</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalViews}</Text>
            <Text style={styles.statLabel}>조회수</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalFavorites}</Text>
            <Text style={styles.statLabel}>관심</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.unreadMessages}</Text>
            <Text style={styles.statLabel}>메시지</Text>
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>빠른 메뉴</Text>
        <View style={styles.quickActions}>
          {variant === 'other' ? (
            <>
              <QuickAction
                icon="💭"
                label="커뮤니티"
                color="#E3EFE9"
                onPress={() => navigation.navigate('Community' as any)}
              />
              <QuickAction
                icon="💬"
                label="메시지"
                color="#FCE7F3"
                onPress={() => navigation.navigate('Messages' as any)}
              />
              <QuickAction
                icon="👤"
                label="프로필"
                color="#FBF1D8"
                onPress={() => navigation.navigate('Profile' as any)}
              />
            </>
          ) : isTenant ? (
            <>
              <QuickAction
                icon="🏠"
                label="매물 검색"
                color="#FFE0CF"
                onPress={() => navigation.navigate('Listings' as any)}
              />
              <QuickAction
                icon="🎯"
                label="AI 매칭"
                color="#FBF1D8"
                onPress={() => navigation.navigate('Matches')}
              />
              <QuickAction
                icon="📋"
                label="인증 관리"
                color="#E3EFE9"
                onPress={() => navigation.navigate('Verification')}
              />
            </>
          ) : (
            <>
              <QuickAction
                icon="🏗️"
                label="매물 관리"
                color="#FFE0CF"
                onPress={() => navigation.navigate('Properties')}
              />
              <QuickAction
                icon="👥"
                label="세입자 탐색"
                color="#FBF1D8"
                onPress={() => navigation.navigate('TenantBrowse')}
              />
              <QuickAction
                icon="💬"
                label="메시지"
                color="#FCE7F3"
                onPress={() => navigation.navigate('Messages' as any)}
              />
            </>
          )}
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const QuickAction: React.FC<{
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}> = ({ icon, label, color, onPress }) => (
  <TouchableOpacity style={styles.actionButton} onPress={onPress}>
    <View style={[styles.actionIcon, { backgroundColor: color }]}>
      <Text style={styles.actionEmoji}>{icon}</Text>
    </View>
    <Text style={styles.actionText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF6EF' },
  welcomeSection: {
    backgroundColor: '#F0663F',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  welcomeSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  trustCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  trustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trustTitle: { fontSize: 16, fontWeight: '600', color: '#4A423C' },
  trustScore: { fontSize: 28, fontWeight: 'bold', color: '#C2451F' },
  trustBar: {
    height: 8,
    backgroundColor: '#E7DFD4',
    borderRadius: 4,
  },
  trustFill: {
    height: 8,
    backgroundColor: '#F0663F',
    borderRadius: 4,
  },
  trustHint: { fontSize: 12, color: '#9A8F87', marginTop: 8 },
  noticeCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noticeTitle: { fontSize: 16, fontWeight: '600', color: '#4A423C' },
  noticeBody: { fontSize: 13, color: '#6B625C', marginTop: 8, lineHeight: 19 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#262220' },
  statLabel: { fontSize: 11, color: '#6B625C', marginTop: 4 },
  section: { marginTop: 24, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#262220', marginBottom: 16 },
  quickActions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionEmoji: { fontSize: 24 },
  actionText: { fontSize: 12, color: '#4A423C', fontWeight: '500' },
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

export default HomeScreen;
