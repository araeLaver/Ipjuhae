import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
export default function PostingConsent({ agreed, onChange }: { agreed: boolean; onChange: (value: boolean) => void }) {
  return <View>
    <Text onPress={() => Linking.openURL('https://www.ipjuhae.com/terms')}>이용약관 보기</Text>
    <Text onPress={() => Linking.openURL('https://www.ipjuhae.com/privacy')}>개인정보처리방침 보기</Text>
    <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => onChange(!agreed)}>
      <Text>{agreed ? '☑' : '☐'} 약관·개인정보 안내를 확인하고, 개인정보 노출·욕설·혐오·광고 게시 금지에 동의합니다.</Text>
    </TouchableOpacity>
  </View>;
}
