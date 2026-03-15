/**
 * AI Matches Screen — matched listings for tenant
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
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../services/apiClient';
import { Listing } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Matches'>;
};

interface MatchedListing extends Listing {
  matchScore?: number;
  matchReasons?: string[];
}

const MatchesScreen: React.FC<Props> = ({ navigation }) => {
  const [matches, setMatches] = useState<MatchedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMatches = useCallback(async () => {
    try {
      const data = await apiClient.get<MatchedListing[]>('/matches');
      setMatches(data);
    } catch (error) {
      console.log('Failed to load matches:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  }, [loadMatches]);

  const renderMatch = ({ item }: { item: MatchedListing }) => {
    const mainImage = item.images?.find((img) => img.isMain) || item.images?.[0];
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('ListingDetail', { listingId: item.id })}
      >
        {mainImage ? (
          <Image source={{ uri: mainImage.thumbnailUrl || mainImage.imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={{ fontSize: 32 }}>🏠</Text>
          </View>
        )}
        {item.matchScore != null && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>{item.matchScore}%</Text>
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
          <Text style={styles.price}>
            보증금 {item.deposit}만 / 월세 {item.monthlyRent}만
          </Text>
          {item.matchReasons && item.matchReasons.length > 0 && (
            <View style={styles.reasons}>
              {item.matchReasons.slice(0, 3).map((reason, i) => (
                <View key={i} style={styles.reasonTag}>
                  <Text style={styles.reasonText}>{reason}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>AI 매칭 중...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={matches}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMatch}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>매칭 결과가 없습니다</Text>
            <Text style={styles.emptySubtext}>프로필의 선호 조건을 설정해주세요</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#6B7280', marginTop: 12 },
  listContent: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  image: { width: '100%', height: 180 },
  imagePlaceholder: { backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  scoreBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#2563EB',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreText: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
  info: { padding: 14 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  address: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  price: { fontSize: 16, fontWeight: 'bold', color: '#2563EB', marginTop: 8 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reasonTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reasonText: { fontSize: 11, color: '#2563EB' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtext: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
});

export default MatchesScreen;
