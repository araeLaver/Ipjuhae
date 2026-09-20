/**
 * 보증금 위험 점검.
 *
 * 로그인 없이 쓴다. 숫자는 전부 사용자가 등기부와 시세에서 직접 읽어 넣는다.
 * 우리가 시세를 추정해서 채우지 않는다. 틀린 시세로 "안전합니다"라고 말하면
 * 이 화면은 도움이 아니라 위험이 된다.
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { colors } from '../theme';
import {
  calculateDepositRisk,
  cushionLabel,
  manwon,
  DepositRiskResult,
  RiskLevel,
} from '../lib/depositRisk';
import * as api from '../services/api';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}

const LEVEL_STYLE: Record<RiskLevel, { bg: string; fg: string; label: string }> = {
  safe: { bg: colors.successTint, fg: colors.success, label: '여유 있음' },
  caution: { bg: colors.warningTint, fg: colors.warning, label: '주의' },
  danger: { bg: colors.dangerTint, fg: colors.danger, label: '위험' },
  critical: { bg: colors.dangerTint, fg: colors.danger, label: '매우 위험' },
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
  const [price, setPrice] = useState('');
  const [deposit, setDeposit] = useState('');
  const [mortgage, setMortgage] = useState('');
  const [prior, setPrior] = useState('');
  const [result, setResult] = useState<DepositRiskResult | null>(null);

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

  function run() {
    if (!ready) return;
    setResult(calculateDepositRisk(input));
  }

  function reset() {
    setPrice('');
    setDeposit('');
    setMortgage('');
    setPrior('');
    setResult(null);
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>보증금, 돌려받을 수 있는 집인가</Text>
        <Text style={styles.lead}>
          등기부와 시세에서 읽은 숫자를 넣으면 계산해 드립니다. 넣으신 숫자는 이 기기를 벗어나지
          않습니다.
        </Text>

        <View style={styles.card}>
          <Field
            label="매매 시세"
            hint="네이버 부동산이나 실거래가에서 본 값"
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

            <TouchableOpacity onPress={reset} style={styles.reset}>
              <Text style={styles.resetText}>다시 넣기</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          이 계산은 넣으신 숫자만 가지고 하는 것입니다. 등기부에 적히지 않는 위험도 있으니 계약
          전에는 등기부를 직접 떼어 확인하세요. 판단이 서지 않으면 커뮤니티에 물어보셔도 됩니다.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
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

  disclaimer: { fontSize: 12, color: colors.faint, lineHeight: 20 },
});

export default DepositCheckScreen;
