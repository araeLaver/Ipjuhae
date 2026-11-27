/**
 * 신뢰센터 · Trust Card · DATA SCORE · 열람 감사로그 화면.
 *
 * 특허 핵심 메커니즘을 모바일에서 직접 제어한다:
 * 1) DATA SCORE — 인적/매물 평가와 분리된 '자료 품질점수' (출처명확성·완전성·최신성·일치성·검증가능성)
 * 2) Trust Card — 거래단계·수신자·목적·만료에 묶인 최소공개 검증카드 + 즉시 회수(Revoke)
 * 3) 검증 사실 · 최소공개 패키지 · 내 정보 열람 감사로그
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import * as api from '../services/api';
import {
  AccessViewLogItem,
  DataScore,
  TrustCardItem,
  TrustReportSummary,
} from '../types';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TrustCenter'>;
}

type DetailTab = 'facts' | 'disclosures' | 'audit';

const DIMENSION_META: Array<{
  key: keyof DataScore['dimensions'];
  label: string;
}> = [
  { key: 'clarity', label: '출처 명확성' },
  { key: 'completeness', label: '자료 완전성' },
  { key: 'recency', label: '자료 최신성' },
  { key: 'consistency', label: '교차 일치성' },
  { key: 'verifiability', label: '검증 가능성' },
];

const CARD_STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  issued: { label: '활성(공개중)', bg: colors.successTint, fg: colors.success },
  revoked: { label: '회수됨', bg: colors.dangerTint, fg: colors.danger },
  expired: { label: '만료됨', bg: colors.sunken, fg: colors.muted },
};

const ROLE_TEXT: Record<string, string> = {
  tenant: '임차인',
  landlord: '임대인',
  broker: '공인중개사',
  institution: '기관',
  private_recipient: '지정 수신자',
};

const FIELD_LABELS: Record<string, string> = {
  identity_verified: '본인확인',
  employment_verified: '재직 확인',
  income_verified: '소득 확인',
  income_requirement_met: '소득 기준 충족',
  credit_verified: '신용 확인',
  relationship_verified: '이전 거래 확인',
  payment_reliable: '납부 성실도',
  ownership_verified: '소유자 확인',
  owner_matched: '소유자 일치',
  registry_clear: '등기부 권리 확인',
  senior_claim_safe: '선순위 채권 안전',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const TrustCenterScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const supportsDataScore = user?.userType === 'tenant' || user?.userType === 'landlord';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [dataScore, setDataScore] = useState<DataScore | null>(null);
  const [cards, setCards] = useState<TrustCardItem[]>([]);
  const [report, setReport] = useState<TrustReportSummary | null>(null);
  const [auditLogs, setAuditLogs] = useState<AccessViewLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<DetailTab>('facts');

  const hasLoadedRef = useRef(false);

  const loadAll = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    }
    try {
      const [scoreRes, cardsRes, reportRes, logsRes] = await Promise.all([
        supportsDataScore ? api.fetchDataScore() : Promise.resolve(null),
        api.fetchTrustCards(),
        api.fetchTrustReport(),
        api.fetchMyViewAuditLogs(20),
      ]);
      setDataScore(scoreRes);
      setCards(cardsRes);
      setReport(reportRes);
      setAuditLogs(logsRes);
      hasLoadedRef.current = true;
      setLoadError(null);
    } catch (error) {
      console.log('Failed to load trust center:', error);
      setLoadError('신뢰센터 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [supportsDataScore]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const confirmRevoke = (card: TrustCardItem) => {
    Alert.alert(
      'Trust Card 즉시 회수',
      `"${card.title}" 카드의 공유 접근을 지금 즉시 차단할까요?\n회수 후에는 기존 공유 링크로 열람할 수 없습니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '즉시 회수',
          style: 'destructive',
          onPress: async () => {
            setRevokingId(card.id);
            try {
              await api.revokeTrustCard(card.id);
              await loadAll();
            } catch {
              Alert.alert('회수 실패', '카드를 회수하지 못했습니다. 잠시 후 다시 시도해 주세요.');
            } finally {
              setRevokingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const activeCardsCount = cards.filter((c) => c.status === 'issued').length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorTitle}>신뢰센터 정보를 불러오지 못했습니다</Text>
          <Text style={styles.errorSubtitle}>
            자료가 비어 있는 상태가 아니라 조회에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAll}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Hero Summary */}
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>EVIDENCE-BOUND TRUST</Text>
        <Text style={styles.heroTitle}>근거 기반 신뢰센터</Text>
        <Text style={styles.heroSubtitle}>
          원본 서류를 통째로 넘기지 않고, 거래단계에 필요한 최소 사실만 검증카드(Trust Card)로
          공유하며 언제든 즉시 회수할 수 있습니다.
        </Text>
        <View style={styles.heroButtons}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('Verification')}
          >
            <Text style={styles.primaryBtnText}>인증 자료 추가</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => Linking.openURL('https://www.ipjuhae.com/trust/reports')}
          >
            <Text style={styles.secondaryBtnText}>웹에서 새 카드 발급</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 1. DATA SCORE */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.flexOne}>
            <Text style={styles.sectionKicker}>DATA SCORE · 자료 품질점수</Text>
            <Text style={styles.cardTitle}>내 증빙 자료 준비도</Text>
          </View>
          {supportsDataScore && dataScore ? (
            <View style={styles.scorePill}>
              <Text style={styles.scorePillValue}>{dataScore.score}</Text>
              <Text style={styles.scorePillMax}>/100</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardHint}>
          사람이나 매물에 대한 평가가 아니라, 제출된 근거 자료 자체의 신뢰·완전·최신성을 측정합니다.
        </Text>

        {supportsDataScore && dataScore ? (
          <View style={styles.dimensionsList}>
            {DIMENSION_META.map(({ key, label }) => {
              const pct = Math.round(Math.max(0, Math.min(1, dataScore.dimensions[key])) * 100);
              return (
                <View key={key} style={styles.dimensionRow}>
                  <View style={styles.dimensionLabelRow}>
                    <Text style={styles.dimensionLabel}>{label}</Text>
                    <Text style={styles.dimensionPct}>{pct}%</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                </View>
              );
            })}
            <Text style={styles.metaFoot}>
              반영된 유효 사실 노드 {dataScore.factCount}건 · 모델 {dataScore.modelVersion}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {supportsDataScore
                ? '아직 산출된 DATA SCORE가 없습니다. 인증 자료를 제출하면 5대 품질 지표가 계산됩니다.'
                : 'DATA SCORE는 임차인·임대인 계정의 증빙 자료를 기준으로 산출됩니다.'}
            </Text>
          </View>
        )}
      </View>

      {/* 2. Trust Cards (Purpose-bound Minimum Disclosure + Instant Revoke) */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.flexOne}>
            <Text style={styles.sectionKicker}>TRUST CARD · 최소공개 검증카드</Text>
            <Text style={styles.cardTitle}>발급한 검증카드 ({activeCardsCount}건 활성)</Text>
          </View>
        </View>
        <Text style={styles.cardHint}>
          수신자 역할·공개 목적·만료일이 고정됩니다. 거래가 중단되거나 정보가 변경되면 즉시 회수해
          후속 열람을 차단할 수 있습니다.
        </Text>

        {cards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>발급된 Trust Card가 아직 없습니다.</Text>
          </View>
        ) : (
          cards.map((card) => {
            const statusMeta = CARD_STATUS_META[card.status] ?? {
              label: card.status,
              bg: colors.sunken,
              fg: colors.muted,
            };
            const isIssued = card.status === 'issued';
            return (
              <View key={card.id} style={styles.trustCardItem}>
                <View style={styles.trustCardTop}>
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusMeta.fg }]}>
                      {statusMeta.label}
                    </Text>
                  </View>
                  {card.tokenPrefix ? (
                    <Text style={styles.tokenPrefix}>{card.tokenPrefix}…</Text>
                  ) : null}
                </View>

                <Text style={styles.trustCardTitle}>{card.title}</Text>
                {card.reportTitle ? (
                  <Text style={styles.trustCardSub}>{card.reportTitle}</Text>
                ) : null}

                <View style={styles.kvList}>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>수신자 역할</Text>
                    <Text style={styles.kvVal}>{ROLE_TEXT[card.audienceRole] ?? card.audienceRole}</Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>공개 목적</Text>
                    <Text style={styles.kvVal}>{card.purpose}</Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>허용 열람</Text>
                    <Text style={styles.kvVal}>{card.allowedViews}회</Text>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvKey}>만료일</Text>
                    <Text style={styles.kvVal}>{formatDate(card.expiresAt)}</Text>
                  </View>
                </View>

                {isIssued ? (
                  <TouchableOpacity
                    style={[styles.revokeBtn, revokingId === card.id && styles.revokeBtnDisabled]}
                    onPress={() => confirmRevoke(card)}
                    disabled={revokingId === card.id}
                  >
                    <Text style={styles.revokeBtnText}>
                      {revokingId === card.id ? '회수 처리 중...' : '즉시 회수 (접근 차단)'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      {/* 3. Evidence Facts / Disclosure Packages / Access Audit Log */}
      <View style={styles.card}>
        <Text style={styles.sectionKicker}>LINEAGE & AUDIT · 근거 및 열람 추적</Text>
        <View style={styles.tabRow}>
          {(
            [
              { id: 'facts', label: `검증 사실 (${report?.facts.length ?? 0})` },
              { id: 'disclosures', label: `공개 패키지 (${report?.disclosures.length ?? 0})` },
              { id: 'audit', label: `열람 로그 (${auditLogs.length})` },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabPill, active && styles.tabPillActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'facts' ? (
          report && report.facts.length > 0 ? (
            report.facts.slice(0, 12).map((fact) => (
              <View key={fact.id} style={styles.listRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.listRowTitle}>
                    {FIELD_LABELS[fact.fieldName] ?? fact.fieldName}
                  </Text>
                  <Text style={styles.listRowSub}>
                    품질 {Math.round(fact.quality * 100)}%
                    {fact.validUntil ? ` · ${formatDate(fact.validUntil)}까지 유효` : ''}
                  </Text>
                </View>
                <View style={styles.smallTag}>
                  <Text style={styles.smallTagText}>{fact.status}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>등록된 검증 사실 노드가 없습니다.</Text>
            </View>
          )
        ) : null}

        {activeTab === 'disclosures' ? (
          report && report.disclosures.length > 0 ? (
            report.disclosures.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.listRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.listRowTitle}>
                    {item.claimKeys.length > 0 ? item.claimKeys.join(', ') : '최소공개 항목'}
                  </Text>
                  <Text style={styles.listRowSub}>
                    정책 {item.policyVersion} · 만료 {formatDate(item.expiresAt)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.smallTag,
                    item.state === 'REVOKED' && { backgroundColor: colors.dangerTint },
                  ]}
                >
                  <Text
                    style={[
                      styles.smallTagText,
                      item.state === 'REVOKED' && { color: colors.danger },
                    ]}
                  >
                    {item.state}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>거래단계별 공개 패키지 이력이 없습니다.</Text>
            </View>
          )
        ) : null}

        {activeTab === 'audit' ? (
          auditLogs.length > 0 ? (
            auditLogs.slice(0, 15).map((log) => (
              <View key={log.id} style={styles.listRow}>
                <View style={styles.flexOne}>
                  <Text style={styles.listRowTitle}>{log.purpose}</Text>
                  <Text style={styles.listRowSub}>
                    대상 {log.targetType} · {formatDate(log.createdAt)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.smallTag,
                    { backgroundColor: log.granted ? colors.successTint : colors.dangerTint },
                  ]}
                >
                  <Text
                    style={[
                      styles.smallTagText,
                      { color: log.granted ? colors.success : colors.danger },
                    ]}
                  >
                    {log.granted ? '허용' : '차단'}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>내 정보 열람 기록이 아직 없습니다.</Text>
            </View>
          )
        ) : null}
      </View>

      <Text style={styles.disclaimer}>
        Trust Card와 DATA SCORE는 제출자료의 확인 상태를 정리한 참고 정보입니다. 계약 전 등기부
        원본과 당사자 신분을 직접 최종 확인해 주세요.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 48 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  flexOne: { flex: 1 },

  errorBanner: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.tint,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: 'center',
  },
  errorTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  errorSubtitle: { fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center', lineHeight: 19 },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: colors.white },

  heroCard: {
    backgroundColor: '#18342E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: '#F4977B' },
  heroTitle: { fontSize: 22, fontWeight: 'bold', color: colors.white, marginTop: 6 },
  heroSubtitle: { fontSize: 13, color: '#E5EFEA', lineHeight: 20, marginTop: 8 },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#7BA396',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.white, fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  sectionKicker: { fontSize: 11, fontWeight: '700', color: colors.primaryInk, letterSpacing: 0.5 },
  cardTitle: { fontSize: 17, fontWeight: 'bold', color: colors.ink, marginTop: 3 },
  cardHint: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 6 },

  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  scorePillValue: { fontSize: 24, fontWeight: 'bold', color: colors.primaryInk },
  scorePillMax: { fontSize: 12, color: colors.muted, marginLeft: 2 },

  dimensionsList: { marginTop: 14, gap: 10 },
  dimensionRow: { gap: 4 },
  dimensionLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dimensionLabel: { fontSize: 13, color: colors.ink, fontWeight: '500' },
  dimensionPct: { fontSize: 13, color: colors.primaryInk, fontWeight: '700' },
  barTrack: { height: 7, backgroundColor: colors.sunken, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 7, backgroundColor: colors.primary, borderRadius: 4 },
  metaFoot: { fontSize: 11, color: colors.faint, marginTop: 4 },

  trustCardItem: {
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.line,
  },
  trustCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  tokenPrefix: { fontSize: 11, color: colors.faint, fontFamily: 'monospace' },
  trustCardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink, marginTop: 8 },
  trustCardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  kvList: { marginTop: 10, gap: 6 },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  kvKey: { fontSize: 12, color: colors.muted },
  kvVal: { fontSize: 12, color: colors.ink, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  revokeBtn: {
    marginTop: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerTint,
    alignItems: 'center',
  },
  revokeBtnDisabled: { opacity: 0.6 },
  revokeBtnText: { fontSize: 13, fontWeight: '700', color: colors.danger },

  tabRow: { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 12, flexWrap: 'wrap' },
  tabPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabPillText: { fontSize: 12, fontWeight: '600', color: colors.muted },
  tabPillTextActive: { color: colors.white },

  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 10,
  },
  listRowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  listRowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  smallTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: colors.sunken,
  },
  smallTagText: { fontSize: 11, fontWeight: '700', color: colors.ink },

  emptyBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.sunken,
    alignItems: 'center',
  },
  emptyText: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },
  disclaimer: { fontSize: 11, color: colors.faint, lineHeight: 18, marginTop: 4, paddingHorizontal: 4 },
});

export default TrustCenterScreen;
