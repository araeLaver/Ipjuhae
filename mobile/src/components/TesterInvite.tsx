/**
 * 앱 테스터 모집 — 웹 `components/tester-invite.tsx`의 RN 판.
 *
 * 계산 결과를 본 직후에만 보여준다. 문안은 웹과 같은 것을 쓴다.
 *
 * 앱 안에 이 배너를 두는 이유: `docs/TESTER_RECRUIT.md` 기준으로 내부 테스트
 * 참여자는 12명 정원에 들어가지 않는다. 지금 앱을 깔고 있는 사람 대부분이
 * 내부 테스트 트랙이므로, 여기서 비공개 테스트 링크로 옮겨 태우는 것이
 * 실제로 카운트를 올리는 동선이다.
 *
 * 노출과 클릭을 익명으로 센다. 기기 ID도 계정도 함께 보내지 않는다.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { colors } from '../theme';
import { trackAnonymous } from '../services/analytics';

const TESTING_URL = 'https://play.google.com/apps/testing/com.ipjuhae.app';

const TesterInvite: React.FC = () => {
  // 결과를 본 뒤에만 렌더되므로 마운트 = 노출이다.
  useEffect(() => {
    trackAnonymous('tester_invite_shown');
  }, []);

  function onPress() {
    trackAnonymous('tester_invite_clicked');
    Linking.openURL(TESTING_URL).catch(() => {
      // 링크를 못 열어도 점검 결과는 그대로 둔다.
    });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>이 계산, 계속 쓰실 수 있게 하는 중입니다</Text>

      <Text style={styles.body}>
        정식 출시하려면 12명이 2주 동안 설치해 두어야 합니다. 구글 정책이라 사람 수가 안 차면
        공개가 안 됩니다. 도와주시면 계속 쓰실 수 있게 만들겠습니다.
      </Text>

      <TouchableOpacity style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>테스터로 참여하기</Text>
      </TouchableOpacity>

      <Text style={styles.note}>링크에서 테스터 되기를 누르고 설치하시면 됩니다</Text>
      <Text style={styles.note}>2주 동안 지우지만 않으시면 됩니다</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.tint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    marginBottom: 16,
  },
  title: { fontSize: 16, fontWeight: 'bold', color: colors.ink, lineHeight: 24 },
  body: { fontSize: 14, color: colors.muted, lineHeight: 22, marginTop: 10 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: 'bold' },
  note: { fontSize: 12, color: colors.muted, lineHeight: 19, marginTop: 8 },
});

export default TesterInvite;
