/**
 * App Navigator for Rentme Mobile
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import ListingsScreen from '../screens/ListingsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import MatchesScreen from '../screens/MatchesScreen';
import VerificationScreen from '../screens/VerificationScreen';
import PropertiesScreen from '../screens/PropertiesScreen';
import TenantBrowseScreen from '../screens/TenantBrowseScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import CommunityPostScreen from '../screens/CommunityPostScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';

// Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ListingDetail: { listingId: string };
  Matches: undefined;
  Verification: undefined;
  Properties: undefined;
  TenantBrowse: undefined;
  ChatRoom: { conversationId: string; otherUserName: string };
  ProfileEdit: undefined;
  References: undefined;
  NotificationSettings: undefined;
  Settings: undefined;
  CommunityPost: { postId: string };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Listings: undefined;
  Community: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const icons: Record<string, string> = {
    Home: '🏠',
    Listings: '🔍',
    Community: '💭',
    Messages: '💬',
    Profile: '👤',
  };
  return (
    <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      {icons[name] || '📱'}
    </Text>
  );
};

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

const MainTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: '#C2451F',
      tabBarInactiveTintColor: '#9A8F87',
      tabBarStyle: {
        paddingBottom: 8,
        paddingTop: 8,
        height: 60,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E7DFD4',
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '홈' }} />
    <Tab.Screen name="Listings" component={ListingsScreen} options={{ tabBarLabel: '매물' }} />
    <Tab.Screen name="Community" component={CommunityScreen} options={{ tabBarLabel: '커뮤니티' }} />
    <Tab.Screen name="Messages" component={MessagesScreen} options={{ tabBarLabel: '메시지' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: '프로필' }} />
  </Tab.Navigator>
);

// Placeholder screen for routes not yet implemented
const PlaceholderScreen = () => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>준비 중입니다</Text>
  </View>
);

/** 로그인 전 화면. 커뮤니티만 연다. */
const GuestNavigator = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#C2451F',
      tabBarInactiveTintColor: '#9A8F87',
      tabBarStyle: {
        paddingBottom: 8,
        paddingTop: 8,
        height: 60,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E7DFD4',
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      tabBarIcon: ({ focused }) => <TabIcon name="Community" focused={focused} />,
    }}
  >
    <Tab.Screen name="Community" component={CommunityScreen} options={{ tabBarLabel: '커뮤니티' }} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>입주해</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabNavigator} />
            <Stack.Screen
              name="ListingDetail"
              component={ListingDetailScreen}
              options={{
                headerShown: true,
                headerTitle: '매물 상세',
                headerBackTitle: '뒤로',
                headerTintColor: '#C2451F',
              }}
            />
            <Stack.Screen
              name="Matches"
              component={MatchesScreen}
              options={{
                headerShown: true,
                headerTitle: 'AI 매칭',
                headerBackTitle: '뒤로',
                headerTintColor: '#C2451F',
              }}
            />
            <Stack.Screen
              name="Verification"
              component={VerificationScreen}
              options={{
                headerShown: true,
                headerTitle: '인증 관리',
                headerBackTitle: '뒤로',
                headerTintColor: '#C2451F',
              }}
            />
            <Stack.Screen
              name="Properties"
              component={PropertiesScreen}
              options={{ headerShown: true, headerTitle: '매물 관리', headerBackTitle: '뒤로', headerTintColor: '#C2451F' }}
            />
            <Stack.Screen
              name="TenantBrowse"
              component={TenantBrowseScreen}
              options={{ headerShown: true, headerTitle: '세입자 탐색', headerBackTitle: '뒤로', headerTintColor: '#C2451F' }}
            />
            <Stack.Screen
              name="ChatRoom"
              component={ChatRoomScreen}
              options={({ route }) => ({
                headerShown: true,
                headerTitle: route.params.otherUserName || '대화',
                headerBackTitle: '뒤로',
                headerTintColor: '#C2451F',
              })}
            />
            <Stack.Screen
              name="ProfileEdit"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '프로필 편집', headerTintColor: '#C2451F' }}
            />
            <Stack.Screen
              name="References"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '레퍼런스 관리', headerTintColor: '#C2451F' }}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={NotificationSettingsScreen}
              options={{ headerShown: true, headerTitle: '알림 설정', headerTintColor: '#C2451F' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, headerTitle: '설정', headerBackTitle: '뒤로', headerTintColor: '#C2451F' }}
            />
            <Stack.Screen
              name="CommunityPost"
              component={CommunityPostScreen}
              options={{ headerShown: true, headerTitle: '', headerBackTitle: '커뮤니티', headerTintColor: '#C2451F' }}
            />
          </>
        ) : (
          <>
            {/* 가입을 권할 단계가 아니다. 로그인 없이도 커뮤니티를 읽고 쓸 수 있어야
                웹과 앞뒤가 맞는다. 로그인은 커뮤니티 안에서 언제든 갈 수 있다. */}
            <Stack.Screen name="Main" component={GuestNavigator} />
            <Stack.Screen
              name="CommunityPost"
              component={CommunityPostScreen}
              options={{ headerShown: true, headerTitle: '', headerBackTitle: '커뮤니티', headerTintColor: '#C2451F' }}
            />
            <Stack.Screen name="Auth" component={AuthNavigator} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0663F',
  },
  loadingText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  tabIcon: { fontSize: 22, opacity: 0.6 },
  tabIconFocused: { opacity: 1 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FBF6EF' },
  placeholderText: { fontSize: 16, color: '#9A8F87' },
});

export default AppNavigator;
