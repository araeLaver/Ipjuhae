/**
 * Listings Screen — browse property listings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { apiClient } from '../services/apiClient';
import { Listing, PaginatedResponse } from '../types';

type ListingsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Listings'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: ListingsScreenNavigationProp;
}

const ListingsScreen: React.FC<Props> = ({ navigation }) => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchListings = useCallback(async (pageNum: number = 0, refresh = false) => {
    try {
      const data = await apiClient.get<PaginatedResponse<Listing>>(
        `/listings?page=${pageNum}&size=20`
      );
      if (refresh || pageNum === 0) {
        setListings(data.content);
      } else {
        setListings((prev) => [...prev, ...data.content]);
      }
      setHasMore(pageNum < data.totalPages - 1);
      setPage(pageNum);
    } catch (error) {
      console.log('Failed to fetch listings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchListings(0);
  }, [fetchListings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchListings(0, true);
  }, [fetchListings]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchListings(page + 1);
  }, [fetchListings, loadingMore, hasMore, page]);

  const formatPrice = (deposit: number, rent: number) => {
    if (deposit >= 10000) {
      return `${(deposit / 10000).toFixed(0)}억 / ${rent}만`;
    }
    return `${deposit}만 / ${rent}만`;
  };

  const renderListing = ({ item }: { item: Listing }) => {
    const mainImage = item.images?.find((img) => img.isMain) || item.images?.[0];
    return (
      <TouchableOpacity
        style={styles.listingCard}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
      >
        {mainImage ? (
          <Image source={{ uri: mainImage.thumbnailUrl || mainImage.imageUrl }} style={styles.listingImage} />
        ) : (
          <View style={[styles.listingImage, styles.imagePlaceholder]}>
            <Text style={styles.placeholderText}>🏠</Text>
          </View>
        )}
        <View style={styles.listingInfo}>
          <Text style={styles.listingTitle} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.listingAddress} numberOfLines={1}>{item.address}</Text>
          <Text style={styles.listingPrice}>
            {formatPrice(item.deposit, item.monthlyRent)}
          </Text>
          <View style={styles.listingMeta}>
            <Text style={styles.metaText}>{item.propertyType}</Text>
            <Text style={styles.metaText}>{item.areaSqm}m²</Text>
            <Text style={styles.metaText}>{item.roomCount}방</Text>
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
        data={listings}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderListing}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#2563EB" style={styles.footer} /> : null
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>등록된 매물이 없습니다</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  listingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  listingImage: { width: '100%', height: 180 },
  imagePlaceholder: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { fontSize: 40 },
  listingInfo: { padding: 14 },
  listingTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  listingAddress: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  listingPrice: { fontSize: 18, fontWeight: 'bold', color: '#2563EB', marginTop: 6 },
  listingMeta: { flexDirection: 'row', gap: 12, marginTop: 8 },
  metaText: { fontSize: 12, color: '#9CA3AF' },
  footer: { paddingVertical: 20 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginTop: 40 },
});

export default ListingsScreen;
