/**
 * Listing Detail Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../services/apiClient';
import { Listing } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ListingDetail'>;
  route: RouteProp<RootStackParamList, 'ListingDetail'>;
};

const { width } = Dimensions.get('window');

const ListingDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { listingId } = route.params;
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);

  const loadListing = useCallback(async () => {
    try {
      const data = await apiClient.get<Listing>(`/listings/${listingId}`);
      setListing(data);
    } catch {
      Alert.alert('오류', '매물 정보를 불러올 수 없습니다.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [listingId, navigation]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  const handleContact = async () => {
    try {
      await apiClient.post('/messages/conversations', {
        listingId,
        message: `"${listing?.title}" 매물에 대해 문의드립니다.`,
      });
      Alert.alert('완료', '메시지가 전송되었습니다.');
    } catch {
      Alert.alert('오류', '메시지 전송에 실패했습니다.');
    }
  };

  if (loading || !listing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  const images = listing.images || [];

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Image Gallery */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / width);
                setImageIndex(idx);
              }}
            >
              {images.map((img, i) => (
                <Image key={i} source={{ uri: img.imageUrl }} style={styles.galleryImage} />
              ))}
            </ScrollView>
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {imageIndex + 1} / {images.length}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noImage}>
            <Text style={{ fontSize: 48 }}>🏠</Text>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{listing.title}</Text>
          <Text style={styles.address}>{listing.address}</Text>

          <View style={styles.priceSection}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>보증금</Text>
              <Text style={styles.priceValue}>{listing.deposit.toLocaleString()}만원</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>월세</Text>
              <Text style={styles.priceValue}>{listing.monthlyRent.toLocaleString()}만원</Text>
            </View>
            {listing.maintenanceFee != null && listing.maintenanceFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>관리비</Text>
                <Text style={styles.priceValue}>{listing.maintenanceFee.toLocaleString()}만원</Text>
              </View>
            )}
          </View>

          <View style={styles.detailGrid}>
            <DetailItem label="유형" value={listing.propertyType} />
            <DetailItem label="면적" value={listing.areaSqm ? `${listing.areaSqm}m²` : '-'} />
            <DetailItem label="방" value={`${listing.roomCount}개`} />
            <DetailItem label="욕실" value={`${listing.bathroomCount}개`} />
            <DetailItem label="층" value={listing.floor ? `${listing.floor}/${listing.totalFloor}층` : '-'} />
            <DetailItem label="조회" value={`${listing.viewCount}회`} />
          </View>

          {listing.options && listing.options.length > 0 && (
            <View style={styles.optionsSection}>
              <Text style={styles.sectionTitle}>옵션</Text>
              <View style={styles.optionsRow}>
                {listing.options.map((opt, i) => (
                  <View key={i} style={styles.optionTag}>
                    <Text style={styles.optionText}>{opt}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {listing.description && (
            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>상세 설명</Text>
              <Text style={styles.descText}>{listing.description}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Contact Button */}
      <View style={styles.contactBar}>
        <TouchableOpacity style={styles.contactButton} onPress={handleContact}>
          <Text style={styles.contactButtonText}>문의하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const DetailItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailItem}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  galleryImage: { width, height: 280 },
  imageCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCounterText: { fontSize: 12, color: '#fff' },
  noImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: { padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  address: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  priceSection: {
    marginTop: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  priceLabel: { fontSize: 14, color: '#6B7280' },
  priceValue: { fontSize: 16, fontWeight: 'bold', color: '#2563EB' },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
    gap: 8,
  },
  detailItem: {
    width: '30%',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  detailLabel: { fontSize: 12, color: '#6B7280' },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#111827', marginTop: 4 },
  optionsSection: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 10 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  optionText: { fontSize: 13, color: '#2563EB' },
  descSection: { marginTop: 20 },
  descText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  contactBar: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  contactButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  contactButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});

export default ListingDetailScreen;
