import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import AccessRestrictionModal from '../../components/AccessRestrictionModal';
import { fetchCurrentUser, getAuthUser, getValidAuthTokens } from '../../lib/api';
import { getAllowedTabNames, isSubscriptionActive } from '../../lib/access';
import { preloadAppData } from '../../lib/appPreload';
import { useLanguage } from '../../lib/i18n';
import { replaceRoute } from '../../lib/navigation';

export default function TabsLayout() {
  const router = useRouter();
  const { t } = useLanguage();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [profileImage, setProfileImage] = useState('');
  const [allowedTabs, setAllowedTabs] = useState<string[] | null>(null);
  const [restrictedSection, setRestrictedSection] = useState('');
  const hasStartedPreloadRef = React.useRef(false);

  useEffect(() => {
    let cancelled = false;

    const guard = async () => {
      try {
        const tokens = await getValidAuthTokens();
        if (cancelled) {
          return;
        }

        if (!tokens) {
          replaceRoute(router, '/login');
          return;
        }

        const cachedUser = await getAuthUser();
        if (cancelled) {
          return;
        }

        if (cachedUser) {
          setProfileImage(String(cachedUser.profileImage || '').trim());

          if (!isSubscriptionActive(cachedUser)) {
            replaceRoute(router, '/plan');
            return;
          }

          setAllowedTabs(getAllowedTabNames(cachedUser));
          setCheckingAuth(false);
        }

        const authUser = await fetchCurrentUser();
        if (cancelled) {
          return;
        }

        setProfileImage(String(authUser?.profileImage || '').trim());

        if (!isSubscriptionActive(authUser)) {
          replaceRoute(router, '/plan');
          return;
        }

        setAllowedTabs(getAllowedTabNames(authUser));
        setCheckingAuth(false);

        if (!hasStartedPreloadRef.current) {
          hasStartedPreloadRef.current = true;
          void preloadAppData();
        }
      } catch {
        if (!cancelled) {
          replaceRoute(router, '/login');
          setCheckingAuth(false);
        }
      }
    };

    void guard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingAuth || allowedTabs === null) {
    return null;
  }

  const visibleTabs = new Set(allowedTabs ?? []);
  const isVisible = (name: string) => visibleTabs.has(name);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarShowLabel: false,
        }}
      >
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
      <Tabs.Screen
        name="workout"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={24} color={color} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (event) => {
            if (isVisible('workout')) {
              return;
            }
            event.preventDefault();
            setRestrictedSection(t('Workout'));
          },
        }}
      />
      <Tabs.Screen
        name="challenge"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={24} color={color} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (event) => {
            if (isVisible('challenge')) {
              return;
            }
            event.preventDefault();
            setRestrictedSection(t('Challenges'));
          },
        }}
      />
      <Tabs.Screen
        name="mealPlan"
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? styles.activeTab : undefined}>
              <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={24} color={color} />
            </View>
          ),
        }}
        listeners={{
          tabPress: (event) => {
            if (isVisible('mealPlan')) {
              return;
            }
            event.preventDefault();
            setRestrictedSection(t('Meal Plan'));
          },
        }}
      />
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
      </Tabs>
      <AccessRestrictionModal
        visible={Boolean(restrictedSection)}
        sectionName={restrictedSection}
        onClose={() => setRestrictedSection('')}
        onUpdatePlan={() => {
          setRestrictedSection('');
          router.push('/plan');
        }}
        onBackHome={() => {
          setRestrictedSection('');
          replaceRoute(router, '/(tabs)');
        }}
      />
    </>
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
