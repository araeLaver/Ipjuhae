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

// Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ListingDetail: { listingId: number };
  Matches: undefined;
  Verification: undefined;
  Properties: undefined;
  TenantBrowse: undefined;
  ChatRoom: { conversationId: number; otherUserName: string };
  ProfileEdit: undefined;
  References: undefined;
  NotificationSettings: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Listings: undefined;
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
      tabBarActiveTintColor: '#2563EB',
      tabBarInactiveTintColor: '#9CA3AF',
      tabBarStyle: {
        paddingBottom: 8,
        paddingTop: 8,
        height: 60,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
    })}
  >
    <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '홈' }} />
    <Tab.Screen name="Listings" component={ListingsScreen} options={{ tabBarLabel: '매물' }} />
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
                headerTintColor: '#2563EB',
              }}
            />
            <Stack.Screen
              name="Matches"
              component={MatchesScreen}
              options={{
                headerShown: true,
                headerTitle: 'AI 매칭',
                headerBackTitle: '뒤로',
                headerTintColor: '#2563EB',
              }}
            />
            <Stack.Screen
              name="Verification"
              component={VerificationScreen}
              options={{
                headerShown: true,
                headerTitle: '인증 관리',
                headerBackTitle: '뒤로',
                headerTintColor: '#2563EB',
              }}
            />
            <Stack.Screen
              name="Properties"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '매물 관리', headerTintColor: '#2563EB' }}
            />
            <Stack.Screen
              name="TenantBrowse"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '세입자 탐색', headerTintColor: '#2563EB' }}
            />
            <Stack.Screen
              name="ChatRoom"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '대화', headerTintColor: '#2563EB' }}
            />
            <Stack.Screen
              name="ProfileEdit"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '프로필 편집', headerTintColor: '#2563EB' }}
            />
            <Stack.Screen
              name="References"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '레퍼런스 관리', headerTintColor: '#2563EB' }}
            />
            <Stack.Screen
              name="NotificationSettings"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '알림 설정', headerTintColor: '#2563EB' }}
            />
            <Stack.Screen
              name="Settings"
              component={PlaceholderScreen}
              options={{ headerShown: true, headerTitle: '설정', headerTintColor: '#2563EB' }}
            />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
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
    backgroundColor: '#2563EB',
  },
  loadingText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  tabIcon: { fontSize: 22, opacity: 0.6 },
  tabIconFocused: { opacity: 1 },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  placeholderText: { fontSize: 16, color: '#9CA3AF' },
});

export default AppNavigator;
