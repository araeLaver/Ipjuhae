/**
 * Register Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { SIGNUP_ROLES } from '../lib/roles';
import { useAuth } from '../contexts/AuthContext';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;
type SignupRole = 'tenant' | 'landlord' | 'broker';

interface Props {
  navigation: RegisterScreenNavigationProp;
}

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [userType, setUserType] = useState<SignupRole>('tenant');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('알림', '모든 필드를 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('알림', '비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('알림', '비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), userType);
    } catch (error: any) {
      Alert.alert('회원가입 실패', error.message || '다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>회원가입</Text>
        <Text style={styles.subtitle}>입주해에 오신 것을 환영합니다</Text>

        {/* User Type Selection */}
        <Text style={styles.label}>유형 선택</Text>
        <View style={styles.typeRow}>
          {SIGNUP_ROLES.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: userType === value }}
              style={[styles.typeButton, userType === value && styles.typeButtonActive]}
              onPress={() => setUserType(value as SignupRole)}
            >
              <Text style={[styles.typeText, userType === value && styles.typeTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>이름</Text>
        <TextInput
          style={styles.input}
          placeholder="이름"
          placeholderTextColor="#9A8F87"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>이메일</Text>
        <TextInput
          style={styles.input}
          placeholder="email@example.com"
          placeholderTextColor="#9A8F87"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>비밀번호</Text>
        <TextInput
          style={styles.input}
          placeholder="8자 이상"
          placeholderTextColor="#9A8F87"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Text style={styles.label}>비밀번호 확인</Text>
        <TextInput
          style={styles.input}
          placeholder="비밀번호 확인"
          placeholderTextColor="#9A8F87"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.registerButton, loading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.registerButtonText}>
            {loading ? '가입 중...' : '회원가입'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.loginLinkText}>
            이미 계정이 있으신가요? <Text style={styles.loginHighlight}>로그인</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#262220' },
  subtitle: { fontSize: 14, color: '#6B625C', marginTop: 4, marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: '#4A423C', marginBottom: 6, marginTop: 16 },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#F3EEE6',
  },
  typeButtonActive: { backgroundColor: '#F0663F' },
  typeText: { fontSize: 15, fontWeight: '600', color: '#6B625C' },
  typeTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#FBF6EF',
    borderWidth: 1,
    borderColor: '#E7DFD4',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#262220',
  },
  registerButton: {
    backgroundColor: '#F0663F',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  registerButtonDisabled: { opacity: 0.6 },
  registerButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  loginLink: { alignItems: 'center', marginTop: 20 },
  loginLinkText: { fontSize: 14, color: '#6B625C' },
  loginHighlight: { color: '#C2451F', fontWeight: '600' },
});

export default RegisterScreen;
