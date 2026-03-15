/**
 * Verification Management Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { apiClient } from '../services/apiClient';
import { VerificationStatus } from '../types';
import { pickImage } from '../services/imageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Verification'>;
};

const VERIF_ITEMS = [
  {
    key: 'employment' as const,
    title: '재직 인증',
    description: '재직증명서 또는 건강보험자격득실확인서를 제출합니다',
    icon: '🏢',
    points: 15,
  },
  {
    key: 'income' as const,
    title: '소득 인증',
    description: '소득금액증명원 또는 급여명세서를 제출합니다',
    icon: '💰',
    points: 15,
  },
  {
    key: 'credit' as const,
    title: '신용 인증',
    description: '신용등급 확인서를 제출합니다',
    icon: '📊',
    points: 15,
  },
];

const VerificationScreen: React.FC<Props> = ({ navigation }) => {
  const [verifications, setVerifications] = useState<VerificationStatus | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadVerifications = useCallback(async () => {
    try {
      const data = await apiClient.get<VerificationStatus>('/verifications');
      setVerifications(data);
    } catch (error) {
      console.log('Failed to load verifications:', error);
    }
  }, []);

  useEffect(() => {
    loadVerifications();
  }, [loadVerifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadVerifications();
    setRefreshing(false);
  }, [loadVerifications]);

  const handleUpload = async (type: string) => {
    const image = await pickImage();
    if (!image) return;

    setUploading(type);
    try {
      await apiClient.uploadFile(`/verifications/documents`, {
        uri: image.uri,
        name: `${type}_doc.jpg`,
        type: 'image/jpeg',
      });
      Alert.alert('완료', '서류가 제출되었습니다. 검토 후 인증이 완료됩니다.');
      await loadVerifications();
    } catch {
      Alert.alert('오류', '서류 제출에 실패했습니다.');
    } finally {
      setUploading(null);
    }
  };

  const isVerified = (key: string) => {
    if (!verifications) return false;
    switch (key) {
      case 'employment': return verifications.employmentVerified;
      case 'income': return verifications.incomeVerified;
      case 'credit': return verifications.creditVerified;
      default: return false;
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>인증 관리</Text>
        <Text style={styles.subtitle}>
          인증을 완료하면 신뢰 점수가 올라갑니다
        </Text>
      </View>

      {VERIF_ITEMS.map((item) => {
        const done = isVerified(item.key);
        const isUploading = uploading === item.key;
        return (
          <View key={item.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>{item.icon}</Text>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>
              <View style={[styles.statusBadge, done && styles.statusDone]}>
                <Text style={[styles.statusText, done && styles.statusTextDone]}>
                  {done ? '완료' : '미인증'}
                </Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.pointsText}>+{item.points}점</Text>
              {!done && (
                <TouchableOpacity
                  style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                  onPress={() => handleUpload(item.key)}
                  disabled={isUploading}
                >
                  <Text style={styles.uploadButtonText}>
                    {isUploading ? '제출 중...' : '서류 제출'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { padding: 24, paddingTop: 16 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardIcon: { fontSize: 28, marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardDescription: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  statusBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusDone: { backgroundColor: '#D1FAE5' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  statusTextDone: { color: '#059669' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pointsText: { fontSize: 14, fontWeight: '600', color: '#2563EB' },
  uploadButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  uploadButtonDisabled: { opacity: 0.6 },
  uploadButtonText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  bottomPadding: { height: 48 },
});

export default VerificationScreen;
