/**
 * Home Dashboard Screen
 * Shows different content based on user type (tenant/landlord)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/apiClient';
import { TenantProfile, DashboardStats } from '../types';
import { colors, shadows } from '../theme';

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [trustScore, setTrustScore] = useState(0);
  const [profileComplete, setProfileComplete] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (user?.userType === 'tenant') {
        const profile = await apiClient.get<TenantProfile>('/profile');
        setTrustScore(profile.trustScore);
        setProfileComplete(profile.isComplete);
      } else if (user?.userType === 'landlord') {
        const dashStats = await apiClient.get<DashboardStats>('/landlord/stats');
        setStats(dashStats);
      }
    } catch (error) {
      console.log('Failed to load home data:', error);
    }
  }, [user?.userType]);

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

  const isTenant = user?.userType === 'tenant';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Welcome */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>
          안녕하세요, {user?.name || '회원'}님!
        </Text>
        <Text style={styles.welcomeSubtext}>
          {isTenant ? '확인 항목과 매물 조건을 함께 비교하세요' : '매물과 확인 요청을 한 화면에서 관리하세요'}
        </Text>
      </View>

      {/* Tenant: Profile Summary */}
      {isTenant && (
        <TouchableOpacity
          style={styles.trustCard}
          onPress={() => navigation.navigate('Profile' as any)}
        >
          <View style={styles.trustHeader}>
            <Text style={styles.trustTitle}>주거 신뢰 리포트</Text>
            <Text style={styles.trustScore}>{trustScore >= 80 ? '우수' : trustScore >= 60 ? '양호' : trustScore >= 40 ? '보통' : '시작'}</Text>
          </View>
          <View style={styles.trustBar}>
            <View style={[styles.trustFill, { width: `${Math.min(trustScore, 100)}%` }]} />
          </View>
          {!profileComplete && (
            <Text style={styles.trustHint}>프로필을 완성하면 요약 정보에 반영됩니다</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Landlord: Stats */}
      {!isTenant && stats && (
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
          {isTenant ? (
            <>
              <QuickAction icon="🏠" label="매물 검색" color={colors.sageSoft} onPress={() => navigation.navigate('Listings' as any)} />
              <QuickAction
                icon="🎯"
                label="AI 매칭"
                color="#F3E8E2"
                onPress={() => navigation.navigate('Matches')}
              />
              <QuickAction
                icon="📋"
                label="인증 관리"
                color={colors.sageSoft}
                onPress={() => navigation.navigate('Verification')}
              />
            </>
          ) : (
            <>
              <QuickAction
                icon="🏗️"
                label="매물 관리"
                color={colors.sageSoft}
                onPress={() => navigation.navigate('Properties')}
              />
              <QuickAction
                icon="👥"
                label="세입자 탐색"
                color="#F3E8E2"
                onPress={() => navigation.navigate('TenantBrowse')}
              />
              <QuickAction
                icon="💬"
                label="메시지"
                color={colors.sageSoft}
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
  container: { flex: 1, backgroundColor: colors.paper },
  welcomeSection: {
    backgroundColor: colors.coral,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: colors.card },
  welcomeSubtext: { fontSize: 14, color: '#F3E8E2', marginTop: 4 },
  trustCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 12,
    padding: 20,
    ...shadows.card,
  },
  trustHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trustTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  trustScore: { fontSize: 28, fontWeight: 'bold', color: colors.sage },
  trustBar: {
    height: 8,
    backgroundColor: colors.line,
    borderRadius: 4,
  },
  trustFill: {
    height: 8,
    backgroundColor: colors.sage,
    borderRadius: 4,
  },
  trustHint: { fontSize: 12, color: colors.muted, marginTop: 8 },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    ...shadows.card,
  },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 4 },
  section: { marginTop: 24, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.ink, marginBottom: 16 },
  quickActions: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1,
    backgroundColor: colors.card,
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
  actionText: { fontSize: 12, color: colors.ink, fontWeight: '500' },
  bottomPadding: { height: 48 },
});

export default HomeScreen;
