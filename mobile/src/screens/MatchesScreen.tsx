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
import * as api from '../services/api';
import { MatchedListing } from '../services/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Matches'>;
};

const MatchesScreen: React.FC<Props> = ({ navigation }) => {
  const [matches, setMatches] = useState<MatchedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    try {
      // GET /api/matches returns { matches: [{ listing, score, reasons, ... }] }
      setMatches(await api.fetchMatches());
      setLoadError(null);
    } catch (error) {
      console.log('Failed to load matches:', error);
      setLoadError('매칭 결과를 불러오지 못했습니다');
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
        <ActivityIndicator size="large" color="#F0663F" />
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
          loadError ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>매칭 결과를 불러오지 못했습니다</Text>
              <Text style={styles.emptySubtext}>매칭 결과가 없는 상태가 아니라 조회에 실패했습니다.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadMatches}>
                <Text style={styles.retryText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>매칭 결과가 없습니다</Text>
              <Text style={styles.emptySubtext}>프로필의 선호 조건을 설정해주세요</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FBF6EF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#6B625C', marginTop: 12 },
  listContent: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', marginBottom: 14 },
  image: { width: '100%', height: 180 },
  imagePlaceholder: { backgroundColor: '#E7DFD4', justifyContent: 'center', alignItems: 'center' },
  scoreBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F0663F',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  scoreText: { fontSize: 13, fontWeight: 'bold', color: '#fff' },
  info: { padding: 14 },
  title: { fontSize: 16, fontWeight: '600', color: '#262220' },
  address: { fontSize: 13, color: '#6B625C', marginTop: 2 },
  price: { fontSize: 16, fontWeight: 'bold', color: '#C2451F', marginTop: 8 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reasonTag: { backgroundColor: '#FFF3DC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  reasonText: { fontSize: 11, color: '#C2451F' },
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#4A423C' },
  emptySubtext: { fontSize: 14, color: '#9A8F87', marginTop: 4, textAlign: 'center' },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F0663F',
  },
  retryText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});

export default MatchesScreen;
