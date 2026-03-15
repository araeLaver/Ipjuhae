/**
 * Properties Screen — landlord's property management
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../services/apiClient';
import { Listing } from '../types';

type PropertiesScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Properties'>;

interface Props {
  navigation: PropertiesScreenNavigationProp;
}

const STATUS_LABELS: Record<string, { text: string; color: string; bg: string }> = {
  available: { text: '공개', color: '#059669', bg: '#ECFDF5' },
  reserved: { text: '예약', color: '#D97706', bg: '#FFFBEB' },
  rented: { text: '계약', color: '#2563EB', bg: '#EFF6FF' },
  hidden: { text: '숨김', color: '#6B7280', bg: '#F3F4F6' },
};

const PropertiesScreen: React.FC<Props> = ({ navigation }) => {
  const [properties, setProperties] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProperties = useCallback(async () => {
    try {
      const data = await apiClient.get<Listing[]>('/landlord/properties');
      setProperties(data);
    } catch (error) {
      console.log('Failed to load properties:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProperties();
    }, [loadProperties])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProperties();
    setRefreshing(false);
  }, [loadProperties]);

  const handleToggleStatus = async (listing: Listing) => {
    const newStatus = listing.status === 'available' ? 'hidden' : 'available';
    try {
      await apiClient.put(`/listings/${listing.id}/status`, { status: newStatus });
      setProperties(prev =>
        prev.map(p => (p.id === listing.id ? { ...p, status: newStatus } : p))
      );
    } catch (error) {
      Alert.alert('오류', '상태 변경에 실패했습니다.');
    }
  };

  const handleDelete = (listing: Listing) => {
    Alert.alert('매물 삭제', `"${listing.title}"을 삭제하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/listings/${listing.id}`);
            setProperties(prev => prev.filter(p => p.id !== listing.id));
          } catch (error) {
            Alert.alert('오류', '삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  const formatPrice = (deposit: number, rent: number) => {
    if (deposit >= 10000) {
      return `${(deposit / 10000).toFixed(deposit % 10000 === 0 ? 0 : 1)}억 / ${rent.toLocaleString()}만`;
    }
    return `${deposit.toLocaleString()} / ${rent.toLocaleString()}만`;
  };

  const renderProperty = ({ item }: { item: Listing }) => {
    const status = STATUS_LABELS[item.status] || STATUS_LABELS.available;
    const mainImage = item.images?.find(img => img.isMain) || item.images?.[0];

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
      >
        {mainImage ? (
          <Image source={{ uri: mainImage.thumbnailUrl || mainImage.imageUrl }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageIcon}>🏠</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
            </View>
          </View>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
          <Text style={styles.price}>{formatPrice(item.deposit, item.monthlyRent)}</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statText}>👁 {item.viewCount}</Text>
            <Text style={styles.statText}>{item.roomCount}방 {item.bathroomCount}욕실</Text>
            {item.areaSqm && <Text style={styles.statText}>{item.areaSqm}㎡</Text>}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToggleStatus(item)}
            >
              <Text style={styles.actionText}>
                {item.status === 'available' ? '숨기기' : '공개'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDelete(item)}
            >
              <Text style={styles.deleteText}>삭제</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
        data={properties}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProperty}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🏠</Text>
            <Text style={styles.emptyTitle}>등록된 매물이 없습니다</Text>
            <Text style={styles.emptySubtitle}>매물을 등록하여 세입자를 찾아보세요</Text>
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
  card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  image: { width: '100%', height: 160 },
  imagePlaceholder: { width: '100%', height: 160, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  imageIcon: { fontSize: 40 },
  cardContent: { padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '600' },
  address: { fontSize: 13, color: '#6B7280', marginBottom: 6 },
  price: { fontSize: 18, fontWeight: '700', color: '#2563EB', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  statText: { fontSize: 12, color: '#9CA3AF' },
  actionRow: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  actionButton: { flex: 1, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 8, alignItems: 'center' },
  actionText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  deleteButton: { backgroundColor: '#FEF2F2' },
  deleteText: { fontSize: 13, fontWeight: '500', color: '#DC2626' },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF' },
});

export default PropertiesScreen;
