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
          {isTenant ? '나에게 맞는 집을 찾아보세요' : '매물을 관리하고 세입자를 만나보세요'}
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
              <QuickAction
                icon="🏠"
                label="매물 검색"
                color="#DBEAFE"
                onPress={() => navigation.navigate('Listings' as any)}
              />
              <QuickAction
                icon="🎯"
                label="AI 매칭"
                color="#FEF3C7"
                onPress={() => navigation.navigate('Matches')}
              />
              <QuickAction
                icon="📋"
                label="인증 관리"
                color="#D1FAE5"
                onPress={() => navigation.navigate('Verification')}
              />
            </>
          ) : (
            <>
              <QuickAction
                icon="🏗️"
                label="매물 관리"
                color="#DBEAFE"
                onPress={() => navigation.navigate('Properties')}
              />
              <QuickAction
                icon="👥"
                label="세입자 탐색"
                color="#FEF3C7"
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  welcomeSection: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
  },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  welcomeSubtext: { fontSize: 14, color: '#BFDBFE', marginTop: 4 },
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
  trustTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  trustScore: { fontSize: 28, fontWeight: 'bold', color: '#2563EB' },
  trustBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  trustFill: {
    height: 8,
    backgroundColor: '#2563EB',
    borderRadius: 4,
  },
  trustHint: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
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
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  section: { marginTop: 24, paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 16 },
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
  actionText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  bottomPadding: { height: 48 },
});

export default HomeScreen;
