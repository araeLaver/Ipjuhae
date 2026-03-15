/**
 * Tenant Browse Screen — landlords browse potential tenants
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../services/apiClient';
import { TenantProfile } from '../types';

type TenantBrowseScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'TenantBrowse'>;

interface Props {
  navigation: TenantBrowseScreenNavigationProp;
}

const TenantBrowseScreen: React.FC<Props> = ({ navigation }) => {
  const [tenants, setTenants] = useState<TenantProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTenants = useCallback(async () => {
    try {
      const data = await apiClient.get<TenantProfile[]>('/landlord/tenants');
      setTenants(data);
    } catch (error) {
      console.log('Failed to load tenants:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTenants();
    }, [loadTenants])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTenants();
    setRefreshing(false);
  }, [loadTenants]);

  const getTrustColor = (score: number) => {
    if (score >= 80) return '#059669';
    if (score >= 60) return '#2563EB';
    if (score >= 40) return '#D97706';
    return '#9CA3AF';
  };

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return '미설정';
    if (min && max) return `${min.toLocaleString()} ~ ${max.toLocaleString()}만`;
    if (max) return `~${max.toLocaleString()}만`;
    return `${min!.toLocaleString()}만~`;
  };

  const renderTenant = ({ item }: { item: TenantProfile }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate('ChatRoom', {
          conversationId: 0,
          otherUserName: item.name,
        })
      }
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{item.name?.[0] || 'T'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.tagRow}>
            {item.familyType && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.familyType}</Text>
              </View>
            )}
            {item.ageRange && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{item.ageRange}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.trustSection}>
          <Text style={[styles.trustScore, { color: getTrustColor(item.trustScore) }]}>
            {item.trustScore}
          </Text>
          <Text style={styles.trustLabel}>신뢰점수</Text>
        </View>
      </View>

      {item.bio && (
        <Text style={styles.bio} numberOfLines={2}>{item.bio}</Text>
      )}

      <View style={styles.detailRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>예산</Text>
          <Text style={styles.detailValue}>{formatBudget(item.budgetMin, item.budgetMax)}</Text>
        </View>
        {item.moveInDate && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>입주 희망</Text>
            <Text style={styles.detailValue}>{item.moveInDate}</Text>
          </View>
        )}
        {item.duration && (
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>거주 기간</Text>
            <Text style={styles.detailValue}>{item.duration}</Text>
          </View>
        )}
      </View>

      {item.preferredDistricts && item.preferredDistricts.length > 0 && (
        <View style={styles.districtRow}>
          {item.preferredDistricts.slice(0, 3).map((d, i) => (
            <View key={i} style={styles.districtTag}>
              <Text style={styles.districtText}>{d}</Text>
            </View>
          ))}
          {item.preferredDistricts.length > 3 && (
            <Text style={styles.moreText}>+{item.preferredDistricts.length - 3}</Text>
          )}
        </View>
      )}

      <View style={styles.infoIcons}>
        {item.pets && item.pets.length > 0 && <Text style={styles.infoIcon}>🐾</Text>}
        {item.smoking && <Text style={styles.infoIcon}>🚬</Text>}
        {!item.smoking && item.smoking !== undefined && <Text style={styles.infoIcon}>🚭</Text>}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tenants}
        keyExtractor={(item) => item.userId.toString()}
        renderItem={renderTenant}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>검색된 세입자가 없습니다</Text>
            <Text style={styles.emptySubtitle}>조건에 맞는 세입자가 등록되면 알려드립니다</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '600', color: '#111827' },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11, color: '#6B7280' },
  trustSection: { alignItems: 'center' },
  trustScore: { fontSize: 22, fontWeight: '700' },
  trustLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  bio: { fontSize: 13, color: '#6B7280', marginBottom: 10, lineHeight: 18 },
  detailRow: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  detailItem: {},
  detailLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '500', color: '#374151' },
  districtRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  districtTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  districtText: { fontSize: 12, color: '#2563EB', fontWeight: '500' },
  moreText: { fontSize: 12, color: '#9CA3AF', alignSelf: 'center' },
  infoIcons: { flexDirection: 'row', gap: 6 },
  infoIcon: { fontSize: 16 },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF' },
});

export default TenantBrowseScreen;
