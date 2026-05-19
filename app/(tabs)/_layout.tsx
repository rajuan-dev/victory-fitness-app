import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchCurrentUser, getValidAuthTokens } from '../../lib/api';
import { getAllowedTabNames, isSubscriptionActive } from '../../lib/access';

export default function TabsLayout() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profileImage, setProfileImage] = useState('');
  const [allowedTabs, setAllowedTabs] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const guard = async () => {
      const tokens = await getValidAuthTokens();
      if (cancelled) {
        return;
      }

      if (!tokens) {
        router.replace('/login');
        return;
      }

      setCheckingAuth(false);
    };

    void guard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      try {
        const authUser = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        setProfileImage(String(authUser?.profileImage || '').trim());

        if (!isSubscriptionActive(authUser)) {
          router.replace('/plan');
          return;
        }

        setAllowedTabs(getAllowedTabNames(authUser));
      } catch {
        if (!cancelled) {
          router.replace('/login');
        }
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
        }
      }
    };

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingAuth) {
    return null;
  }

  const visibleTabs = new Set(allowedTabs ?? []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: false,
      }}
    >
      {visibleTabs.has('index') && (
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeTab : undefined}>
                <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
      )}
      {visibleTabs.has('workout') && (
        <Tabs.Screen
          name="workout"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeTab : undefined}>
                <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
      )}
      {visibleTabs.has('challenge') && (
        <Tabs.Screen
          name="challenge"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeTab : undefined}>
                <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
      )}
      {visibleTabs.has('mealPlan') && (
        <Tabs.Screen
          name="mealPlan"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeTab : undefined}>
                <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={24} color={color} />
              </View>
            ),
          }}
        />
      )}
      {visibleTabs.has('profile') && (
        <Tabs.Screen
          name="profile"
          options={{
            tabBarIcon: ({ color, focused }) => (
              <View style={focused ? styles.activeTab : undefined}>
                <View style={styles.profileBadge}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.profileAvatar} />
                  ) : (
                    <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
                  )}
                </View>
              </View>
            ),
          }}
        />
      )}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0A0A14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(0, 240, 208, 0.12)',
    borderRadius: 16,
    padding: 8,
  },
  profileBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
});
