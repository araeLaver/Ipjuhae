/**
 * 보증금 위험 점검 + 등기부 텍스트 10초 자동 채우기 + HUG 126% 판정 + 맞춤 특약 공유.
 *
 * 로그인 없이 쓴다. 숫자와 붙여넣은 등기부 텍스트는 전부 이 기기 로컬에서만
 * 계산·파싱되며 서버로 전송하지 않는다.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../theme';
import {
  calculateDepositRisk,
  cushionLabel,
  manwon,
  DepositRiskResult,
  RiskLevel,
} from '../lib/depositRisk';
import { parseRegistryText, RegistryParseResult } from '../lib/registryParser';
import {
  calculateHugEligibility,
  HugVerdict,
  RegionType,
  ValuationBasis,
} from '../lib/hugCheck';
import { buildSpecialTerms } from '../lib/specialTerms';
import {
  addDepositCandidate,
  MAX_SAVED_CANDIDATES,
  parseSavedCandidates,
  pickSafestCandidate,
  removeDepositCandidate,
  SavedDepositCandidate,
} from '../lib/depositCandidates';
import { DEPOSIT_CANDIDATES_KEY } from '../services/storageKeys';
import * as api from '../services/api';
import { trackAnonymous } from '../services/analytics';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

const LEVEL_STYLE: Record<RiskLevel, { bg: string; fg: string; label: string }> = {
  safe: { bg: colors.successTint, fg: colors.success, label: '여유 있음' },
  caution: { bg: colors.warningTint, fg: colors.warning, label: '주의' },
  danger: { bg: colors.dangerTint, fg: colors.danger, label: '위험' },
  critical: { bg: colors.dangerTint, fg: colors.danger, label: '매우 위험' },
};

const SAMPLE_REGISTRY_TEXT = [
  '【갑구】 3번 가압류 (청구금액 금 35,000,000원)',
  '【을구】 1번 근저당권설정 채권최고액 금 120,000,000원 근저당권자 ○○은행',
  '【을구】 2번 근저당권말소 채권최고액 금 40,000,000원 (말소됨)',
].join('\n');

const HUG_STYLE: Record<HugVerdict, { bg: string; fg: string; label: string }> = {
  likely: { bg: colors.successTint, fg: colors.success, label: '한도 안쪽' },
  caution: { bg: colors.warningTint, fg: colors.warning, label: '조건 확인 필요' },
  ineligible: { bg: colors.dangerTint, fg: colors.danger, label: '한도 초과' },
};

interface FieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}

const Field: React.FC<FieldProps> = ({ label, hint, value, onChange, placeholder }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Text style={styles.fieldHint}>{hint}</Text>
    <View style={styles.inputRow}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        maxLength={9}
      />
      <Text style={styles.unit}>만원</Text>
    </View>
    {value ? <Text style={styles.readback}>{manwon(Number(value))}</Text> : null}
  </View>
);

const DepositCheckScreen: React.FC<Props> = ({ navigation }) => {
  const { isAuthenticated } = useAuth();
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [mortgage, setMortgage] = useState('');
  const [prior, setPrior] = useState('');
  const [result, setResult] = useState<DepositRiskResult | null>(null);

  // 기기 로컬 후보 집 저장 · 비교함 (최대 5곳)
  const [candidates, setCandidates] = useState<SavedDepositCandidate[]>([]);
  const [candidateLabel, setCandidateLabel] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // 등기부 텍스트 10초 자동 채우기 (100% 기기 로컬)
  const [showRegistryBox, setShowRegistryBox] = useState(false);
  const [registryText, setRegistryText] = useState('');
  const [registryParsed, setRegistryParsed] = useState<RegistryParseResult | null>(null);

  // HUG 보증보험 간편 판정 옵션
  const [hugBasis, setHugBasis] = useState<ValuationBasis>('market_price');
  const [hugRegion, setHugRegion] = useState<RegionType>('metro');

  useEffect(() => {
    AsyncStorage.getItem(DEPOSIT_CANDIDATES_KEY)
      .then((raw) => setCandidates(parseSavedCandidates(raw)))
      .catch(() => undefined);
  }, []);

  const safestCandidate = useMemo(() => pickSafestCandidate(candidates), [candidates]);

  const ready = price.length > 0 && deposit.length > 0 && Number(price) > 0;

  const input = useMemo(
    () => ({
      marketPriceManwon: Number(price || 0),
      depositManwon: Number(deposit || 0),
      mortgageMaxManwon: Number(mortgage || 0),
      priorDepositsManwon: Number(prior || 0),
    }),
    [price, deposit, mortgage, prior]
  );

  const hugResult = useMemo(() => {
    if (!result) return null;
    return calculateHugEligibility({
      basis: hugBasis,
      basePriceManwon: input.marketPriceManwon,
      depositManwon: input.depositManwon,
      seniorDebtManwon: input.mortgageMaxManwon + input.priorDepositsManwon,
      region: hugRegion,
    });
  }, [result, hugBasis, hugRegion, input]);

  const specialTerms = useMemo(() => {
    if (!result) return null;
    return buildSpecialTerms({
      hasMortgage: input.mortgageMaxManwon > 0,
      hasPriorTenants: input.priorDepositsManwon > 0,
      needsJeonseLoan: true,
      needsInsurance: true,
      hasPet: false,
      needsRepairCheck: true,
    });
  }, [result, input.mortgageMaxManwon, input.priorDepositsManwon]);

  /**
   * 결과가 화면에 그려진 순간을 익명으로 센다.
   * 위험 등급만 보내고, 넣으신 금액은 보내지 않는다 — 위 안내문에
   * "이 기기를 벗어나지 않습니다"라고 적어 뒀다.
   */
  useEffect(() => {
    if (!result) return;
    trackAnonymous('check_result_viewed', { level: result.level });
  }, [result]);

  function run() {
    if (!ready) return;
    setSavedNotice(null);
    setResult(calculateDepositRisk(input));
  }

  function persistCandidates(next: SavedDepositCandidate[]) {
    setCandidates(next);
    AsyncStorage.setItem(DEPOSIT_CANDIDATES_KEY, JSON.stringify(next)).catch(() => undefined);
  }

  function handleSaveCandidate() {
    if (!result) return;
    const next = addDepositCandidate(candidates, {
      label: candidateLabel,
      marketPriceManwon: input.marketPriceManwon,
      depositManwon: input.depositManwon,
      mortgageMaxManwon: input.mortgageMaxManwon,
      priorDepositsManwon: input.priorDepositsManwon,
      level: result.level,
      burdenRatio: result.burdenRatio,
      auctionCushionManwon: result.auctionCushionManwon,
    });
    persistCandidates(next);
    setCandidateLabel('');
    setSavedNotice(`"${next[0].label}" 후보 함에 저장했습니다. 아래에서 다른 집과 비교해 보세요.`);
  }

  function handleLoadCandidate(item: SavedDepositCandidate) {
    setPrice(String(item.marketPriceManwon));
    setDeposit(String(item.depositManwon));
    setMortgage(item.mortgageMaxManwon ? String(item.mortgageMaxManwon) : '');
    setPrior(item.priorDepositsManwon ? String(item.priorDepositsManwon) : '');
    setCandidateLabel(item.label);
    setSavedNotice(null);
    setResult(
      calculateDepositRisk({
        marketPriceManwon: item.marketPriceManwon,
        depositManwon: item.depositManwon,
        mortgageMaxManwon: item.mortgageMaxManwon,
        priorDepositsManwon: item.priorDepositsManwon,
      })
    );
  }

  function handleDeleteCandidate(id: string) {
    persistCandidates(removeDepositCandidate(candidates, id));
  }

  function reset() {
    setPrice('');
    setDeposit('');
    setMortgage('');
    setPrior('');
    setResult(null);
    setRegistryText('');
    setRegistryParsed(null);
    setCandidateLabel('');
    setSavedNotice(null);
  }

  function handleParseRegistry(sourceText = registryText) {
    const parsed = parseRegistryText(sourceText);
    setRegistryParsed(parsed);
    if (parsed.mortgageMaxManwon > 0) {
      setMortgage(String(parsed.mortgageMaxManwon));
    }
  }

  function handleTrySample() {
    setRegistryText(SAMPLE_REGISTRY_TEXT);
    const parsed = parseRegistryText(SAMPLE_REGISTRY_TEXT);
    setRegistryParsed(parsed);
    if (!price) setPrice('30000');
    if (!deposit) setDeposit('22000');
    if (parsed.mortgageMaxManwon > 0) {
      setMortgage(String(parsed.mortgageMaxManwon));
    }
  }

  async function shareText(title: string, message: string) {
    try {
      await Share.share({ title, message });
    } catch {
      // 사용자가 공유 시트를 닫은 경우 무시한다.
    }
  }

  /** 관련 글을 제목으로 찾아 연다. 목록 API에 제목이 있으니 그걸로 맞춘다. */
  async function openGuide(title: string) {
    try {
      const posts = await api.fetchCommunityPosts();
      const found = posts.find((p) => p.title === title);
      if (found) navigation.navigate('CommunityPost', { postId: found.id });
    } catch {
      // 글을 못 열어도 점검 결과는 그대로 둔다.
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>보증금, 돌려받을 수 있는 집인가</Text>
        <Text style={styles.lead}>
          등기부와 시세에서 읽은 숫자를 넣으면 계산해 드립니다. 넣으신 숫자와 등기부 텍스트는 이
          기기를 벗어나지 않습니다.
        </Text>

        {/* 등기부 텍스트 10초 자동 채우기 */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.quickToggleRow}
            onPress={() => setShowRegistryBox((prev) => !prev)}
          >
            <View style={styles.flexOne}>
              <Text style={styles.quickKicker}>10초 자동 입력 · 기기 로컬 분석</Text>
              <Text style={styles.quickTitle}>등기부 텍스트 붙여넣기 (근저당·위험신호 자동 추출)</Text>
            </View>
            <Text style={styles.quickChevron}>{showRegistryBox ? '접기' : '열기'}</Text>
          </TouchableOpacity>

          {showRegistryBox ? (
            <View style={styles.registryBody}>
              <Text style={styles.fieldHint}>
                인터넷등기소에서 복사한 갑구·을구 텍스트를 붙여넣으면 근저당 채권최고액 합계와 6대
                위험 신호(경매·신탁·압류·가압류·임차권등기·가등기)를 기기 안에서 바로 뽑아줍니다.
              </Text>
              <TextInput
                style={styles.registryInput}
                value={registryText}
                onChangeText={setRegistryText}
                placeholder="예: 을구 1번 근저당권설정 채권최고액 금 120,000,000원..."
                placeholderTextColor={colors.faint}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.shareBtnRow}>
                <TouchableOpacity
                  style={[styles.secondaryActionBtn, styles.flexOne, !registryText.trim() && styles.buttonOff]}
                  onPress={() => handleParseRegistry()}
                  disabled={!registryText.trim()}
                >
                  <Text style={styles.secondaryActionText}>채권최고액 · 위험 추출</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sampleBtn}
                  onPress={handleTrySample}
                >
                  <Text style={styles.sampleBtnText}>예시 3초 체험</Text>
                </TouchableOpacity>
              </View>

              {registryParsed ? (
                <View style={styles.parsedSummary}>
                  {registryParsed.flags.length > 0 ? (
                    <View style={styles.flagList}>
                      <Text style={styles.flagHeading}>
                        ⚠️ 위험 신호 {registryParsed.flags.length}건 감지
                      </Text>
                      {registryParsed.flags.map((flag) => (
                        <View key={flag.code} style={styles.flagBox}>
                          <Text style={styles.flagLabel}>{flag.label}</Text>
                          <Text style={styles.flagDesc}>{flag.summary}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {registryParsed.notes.map((note, idx) => (
                    <Text key={idx} style={styles.parsedNote}>
                      • {note}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Field
            label="매매 시세 (또는 공시가격)"
            hint="네이버 부동산·실거래가 또는 공동주택 공시가격"
            value={price}
            onChange={setPrice}
            placeholder="40000"
          />
          <Field
            label="내 보증금"
            hint="계약하려는 전세금 또는 보증금"
            value={deposit}
            onChange={setDeposit}
            placeholder="30000"
          />
          <Field
            label="근저당 채권최고액"
            hint="등기부 을구에 적힌 금액의 합계. 없으면 비워두세요"
            value={mortgage}
            onChange={setMortgage}
            placeholder="0"
          />
          <Field
            label="선순위 보증금"
            hint="다가구라면 나보다 먼저 들어온 세입자들의 보증금 합계"
            value={prior}
            onChange={setPrior}
            placeholder="0"
          />

          <TouchableOpacity
            style={[styles.button, !ready && styles.buttonOff]}
            onPress={run}
            disabled={!ready}
          >
            <Text style={styles.buttonText}>확인하기</Text>
          </TouchableOpacity>
          {!ready ? (
            <Text style={styles.needMore}>시세와 보증금은 넣어주셔야 계산됩니다</Text>
          ) : null}
        </View>

        {result ? (
          <View style={styles.card}>
            <View style={[styles.badge, { backgroundColor: LEVEL_STYLE[result.level].bg }]}>
              <Text style={[styles.badgeText, { color: LEVEL_STYLE[result.level].fg }]}>
                {LEVEL_STYLE[result.level].label}
              </Text>
            </View>

            <Text style={styles.headline}>{result.headline}</Text>
            <Text style={styles.detail}>{result.detail}</Text>

            <View style={styles.numbers}>
              <View style={styles.numberRow}>
                <Text style={styles.numberLabel}>내 앞에 있는 돈</Text>
                <Text style={styles.numberValue}>{manwon(result.seniorTotalManwon)}</Text>
              </View>
              <View style={styles.numberRow}>
                <Text style={styles.numberLabel}>시세대로 팔릴 때</Text>
                <Text
                  style={[
                    styles.numberValue,
                    result.cushionManwon < 0 && styles.numberBad,
                  ]}
                >
                  {cushionLabel(result.cushionManwon)}
                </Text>
              </View>
              <View style={styles.numberRow}>
                <Text style={styles.numberLabel}>경매로 넘어갈 때</Text>
                <Text
                  style={[
                    styles.numberValue,
                    result.auctionCushionManwon < 0 && styles.numberBad,
                  ]}
                >
                  {cushionLabel(result.auctionCushionManwon)}
                </Text>
              </View>
            </View>

            {/* HUG 126% / 시세 90% 보증보험 간편 판정 */}
            {hugResult ? (
              <View style={styles.subPanel}>
                <View style={styles.subPanelHeader}>
                  <Text style={styles.subPanelTitle}>HUG 전세보증보험 한도 판정</Text>
                  <View style={[styles.badge, { backgroundColor: HUG_STYLE[hugResult.verdict].bg }]}>
                    <Text style={[styles.badgeText, { color: HUG_STYLE[hugResult.verdict].fg }]}>
                      {HUG_STYLE[hugResult.verdict].label}
                    </Text>
                  </View>
                </View>

                <View style={styles.pillRow}>
                  <TouchableOpacity
                    style={[styles.togglePill, hugBasis === 'market_price' && styles.togglePillOn]}
                    onPress={() => setHugBasis('market_price')}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        hugBasis === 'market_price' && styles.togglePillTextOn,
                      ]}
                    >
                      시세 90%
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.togglePill, hugBasis === 'official_price' && styles.togglePillOn]}
                    onPress={() => setHugBasis('official_price')}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        hugBasis === 'official_price' && styles.togglePillTextOn,
                      ]}
                    >
                      공시가격 126%
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.togglePill, hugRegion === 'metro' && styles.togglePillOn]}
                    onPress={() => setHugRegion('metro')}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        hugRegion === 'metro' && styles.togglePillTextOn,
                      ]}
                    >
                      수도권(7억)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.togglePill, hugRegion === 'non_metro' && styles.togglePillOn]}
                    onPress={() => setHugRegion('non_metro')}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        hugRegion === 'non_metro' && styles.togglePillTextOn,
                      ]}
                    >
                      비수도권(5억)
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.hugHeadline}>{hugResult.headline}</Text>
                <Text style={styles.hugMeta}>
                  최대 가입 가능 보증금: {manwon(hugResult.maxEligibleDepositManwon)}
                  {hugResult.officialPriceMultiple !== null
                    ? ` · 공시가 대비 ${Math.round(hugResult.officialPriceMultiple * 100)}%`
                    : ` · 주택가 대비 ${Math.round(hugResult.ltvRatio * 100)}%`}
                </Text>
                {hugResult.reasons[0] ? (
                  <Text style={styles.hugReason}>{hugResult.reasons[0]}</Text>
                ) : null}
              </View>
            ) : null}

            {/* 이 집 맞춤 필수 특약 + 중개사 카톡 요청 문자 */}
            {specialTerms ? (
              <View style={styles.subPanel}>
                <Text style={styles.subPanelTitle}>
                  이 집 맞춤 필수 특약 ({specialTerms.items.length}개)
                </Text>
                <Text style={styles.hugMeta}>
                  근저당·선순위 입력값에 맞춰 계약서에 꼭 넣어야 할 특약과 중개사 요청 문자를
                  준비했습니다.
                </Text>
                {specialTerms.items.slice(0, 4).map((item, idx) => (
                  <Text key={item.id} style={styles.termPreview}>
                    {idx + 1}. {item.title}
                  </Text>
                ))}
                <View style={styles.shareBtnRow}>
                  <TouchableOpacity
                    style={styles.sharePrimaryBtn}
                    onPress={() => shareText('중개사 특약 요청 문자', specialTerms.politeMessage)}
                  >
                    <Text style={styles.sharePrimaryText}>중개사 카톡 문자 공유</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.shareSecondaryBtn}
                    onPress={() => shareText('계약서 필수 특약 문구', specialTerms.contractText)}
                  >
                    <Text style={styles.shareSecondaryText}>특약 전문 공유</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>지금 하실 일</Text>
            {result.actions.map((a, i) => (
              <View key={i} style={styles.actionRow}>
                <Text style={styles.actionNum}>{i + 1}</Text>
                <Text style={styles.actionText}>{a}</Text>
              </View>
            ))}

            <Text style={styles.sectionTitle}>함께 보면 좋은 글</Text>
            {result.relatedGuides.map((g) => (
              <TouchableOpacity key={g} onPress={() => openGuide(g)} style={styles.guideRow}>
                <Text style={styles.guideText}>{g}</Text>
              </TouchableOpacity>
            ))}

            {/* 후보 집 비교함에 저장 */}
            <View style={styles.subPanel}>
              <Text style={styles.subPanelTitle}>
                이 집 후보에 저장해 비교하기 ({candidates.length}/{MAX_SAVED_CANDIDATES})
              </Text>
              <Text style={styles.hugMeta}>
                부동산에서 본 집을 최대 {MAX_SAVED_CANDIDATES}곳까지 기기에 저장해 안전도를 비교할 수 있습니다.
              </Text>
              <View style={styles.saveCandidateRow}>
                <TextInput
                  style={styles.candidateInput}
                  value={candidateLabel}
                  onChangeText={setCandidateLabel}
                  placeholder="메모 (예: 역삼동 투룸 3층)"
                  placeholderTextColor={colors.faint}
                  maxLength={40}
                />
                <TouchableOpacity style={styles.saveCandidateBtn} onPress={handleSaveCandidate}>
                  <Text style={styles.saveCandidateBtnText}>후보 저장</Text>
                </TouchableOpacity>
              </View>
              {savedNotice ? <Text style={styles.savedNotice}>{savedNotice}</Text> : null}
            </View>

            <TouchableOpacity onPress={reset} style={styles.reset}>
              <Text style={styles.resetText}>다시 넣기</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* 저장한 후보 집 비교 섹션 */}
        {candidates.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.subPanelHeader}>
              <Text style={styles.quickTitle}>
                저장한 후보 집 비교 ({candidates.length}/{MAX_SAVED_CANDIDATES})
              </Text>
              {candidates.length >= 2 && safestCandidate ? (
                <View style={styles.safestPill}>
                  <Text style={styles.safestPillText}>가장 안전: {safestCandidate.label}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.hugMeta}>이 목록은 기기 로컬에만 저장되며 서버로 전송되지 않습니다.</Text>
            {candidates.map((item) => {
              const meta = LEVEL_STYLE[item.level];
              return (
                <View key={item.id} style={styles.candidateCard}>
                  <View style={styles.subPanelHeader}>
                    <Text style={styles.candidateTitle} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.badgeText, { color: meta.fg }]}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.candidateStats}>
                    시세 {manwon(item.marketPriceManwon)} · 보증금 {manwon(item.depositManwon)} · 경매 시{' '}
                    {cushionLabel(item.auctionCushionManwon)}
                  </Text>
                  <View style={styles.candidateActions}>
                    <TouchableOpacity
                      style={styles.candidateLoadBtn}
                      onPress={() => handleLoadCandidate(item)}
                    >
                      <Text style={styles.candidateLoadText}>다시 보기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.candidateDeleteBtn}
                      onPress={() => handleDeleteCandidate(item.id)}
                    >
                      <Text style={styles.candidateDeleteText}>삭제</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* 특허 신뢰센터 / 무료 가입 전환 브리지 (결과 확인 직후 노출) */}
        {result ? (
          <View style={styles.trustBridgeCard}>
            <Text style={styles.trustBridgeKicker}>PATENT TRUST ENGINE · 입주해 신뢰센터</Text>
            <Text style={styles.trustBridgeTitle}>
              {isAuthenticated
                ? '특허 Trust Card로 계약 전 신뢰를 안전하게 공유하세요'
                : '무료 회원가입하면 Trust Card · 열람기록까지 바로 쓸 수 있어요'}
            </Text>
            <Text style={styles.trustBridgeBody}>
              원본 서류를 통째로 넘기지 않고 최소 사실만 검증카드로 공유하며, 원할 때 원탭으로 즉시
              회수할 수 있습니다.
            </Text>
            <TouchableOpacity
              style={styles.trustBridgeBtn}
              onPress={() =>
                navigation.navigate((isAuthenticated ? 'TrustCenter' : 'Auth') as any)
              }
            >
              <Text style={styles.trustBridgeBtnText}>
                {isAuthenticated ? '신뢰센터 · Trust Card 열기' : '무료로 시작하기 (로그인 / 회원가입)'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          이 계산은 넣으신 숫자만 가지고 하는 것입니다. 등기부에 적히지 않는 위험도 있으니 계약
          전에는 등기부를 직접 떼어 확인하세요. 판단이 서지 않으면 커뮤니티에 물어보셔도 됩니다.
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 48 },

  title: { fontSize: 22, fontWeight: 'bold', color: colors.ink, lineHeight: 31 },
  lead: { fontSize: 14, color: colors.muted, lineHeight: 22, marginTop: 8, marginBottom: 20 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 16,
  },

  quickToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickKicker: { fontSize: 11, fontWeight: '700', color: colors.primaryInk },
  quickTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 2 },
  quickChevron: { fontSize: 13, fontWeight: '700', color: colors.primaryInk },
  registryBody: { marginTop: 12 },
  registryInput: {
    marginTop: 10,
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sunken,
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: colors.ink,
  },
  secondaryActionBtn: {
    backgroundColor: '#18342E',
    borderRadius: 9,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryActionText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  sampleBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.tint,
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBtnText: { color: colors.primaryInk, fontSize: 13, fontWeight: '700' },
  parsedSummary: { marginTop: 12, gap: 6 },
  flagList: { gap: 6, marginBottom: 4 },
  flagHeading: { fontSize: 13, fontWeight: '700', color: colors.danger },
  flagBox: {
    backgroundColor: colors.dangerTint,
    borderRadius: 8,
    padding: 10,
  },
  flagLabel: { fontSize: 13, fontWeight: '700', color: colors.danger },
  flagDesc: { fontSize: 12, color: colors.ink, marginTop: 2, lineHeight: 18 },
  parsedNote: { fontSize: 12, color: colors.muted, lineHeight: 18 },

  field: { marginBottom: 18 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  fieldHint: { fontSize: 12, color: colors.faint, marginTop: 3, lineHeight: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.sunken,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.ink,
  },
  unit: { fontSize: 14, color: colors.muted, marginLeft: 8 },
  readback: { fontSize: 12, color: colors.primaryInk, marginTop: 6 },

  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonOff: { backgroundColor: colors.primaryMuted },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: 'bold' },
  needMore: { fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 8 },

  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 13, fontWeight: 'bold' },
  headline: { fontSize: 18, fontWeight: 'bold', color: colors.ink, lineHeight: 27, marginTop: 12 },
  detail: { fontSize: 14, color: colors.muted, lineHeight: 23, marginTop: 10 },

  numbers: {
    backgroundColor: colors.sunken,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    gap: 10,
  },
  numberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numberLabel: { fontSize: 13, color: colors.muted },
  numberValue: { fontSize: 14, fontWeight: '600', color: colors.ink },
  numberBad: { color: colors.danger },

  subPanel: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.line,
  },
  subPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  subPanelTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  togglePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  togglePillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  togglePillText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  togglePillTextOn: { color: colors.white },
  hugHeadline: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 10 },
  hugMeta: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 18 },
  hugReason: { fontSize: 12, color: colors.ink, marginTop: 6, lineHeight: 18 },
  termPreview: { fontSize: 12, color: colors.ink, marginTop: 5, fontWeight: '500' },
  shareBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  sharePrimaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  sharePrimaryText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  shareSecondaryBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareSecondaryText: { color: colors.primaryInk, fontSize: 12, fontWeight: '700' },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.ink,
    marginTop: 22,
    marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionNum: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primaryInk,
    width: 16,
    lineHeight: 22,
  },
  actionText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 22 },

  guideRow: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  guideText: { fontSize: 13, color: colors.primaryInk },

  reset: { alignSelf: 'center', marginTop: 18 },
  resetText: { fontSize: 13, color: colors.muted, textDecorationLine: 'underline' },

  saveCandidateRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  candidateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.ink,
  },
  saveCandidateBtn: {
    backgroundColor: '#18342E',
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveCandidateBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  savedNotice: { fontSize: 12, color: colors.success, fontWeight: '600', marginTop: 8 },

  safestPill: {
    backgroundColor: colors.successTint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  safestPillText: { fontSize: 11, fontWeight: '700', color: colors.success },
  candidateCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.line,
  },
  candidateTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink },
  candidateStats: { fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 18 },
  candidateActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  candidateLoadBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  candidateLoadText: { fontSize: 12, fontWeight: '700', color: colors.primaryInk },
  candidateDeleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  candidateDeleteText: { fontSize: 12, fontWeight: '600', color: colors.muted },

  trustBridgeCard: {
    backgroundColor: '#18342E',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  trustBridgeKicker: { fontSize: 11, fontWeight: '700', color: '#F4977B', letterSpacing: 0.6 },
  trustBridgeTitle: { fontSize: 16, fontWeight: 'bold', color: colors.white, marginTop: 6, lineHeight: 23 },
  trustBridgeBody: { fontSize: 13, color: '#D9E6E0', lineHeight: 20, marginTop: 6 },
  trustBridgeBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  trustBridgeBtnText: { color: colors.white, fontSize: 14, fontWeight: 'bold' },

  disclaimer: { fontSize: 12, color: colors.faint, lineHeight: 20 },
});

export default DepositCheckScreen;
