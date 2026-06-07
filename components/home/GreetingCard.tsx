import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { fetchCurrentUser, getAuthUser } from '../../lib/api';
import { useLanguage } from '../../lib/i18n';

const QUOTES = [
  { textKey: 'WISDOM LISTENS BEFORE IT LEADS.', authorKey: 'Victor Akko' },
  { textKey: 'YOUR ONLY LIMIT IS YOUR MIND.', authorKey: 'Focus' },
  { textKey: 'VICTORY BELONGS TO THE MOST PERSEVERING.', authorKey: 'Napoleon' },
  { textKey: 'STRENGTH DOES NOT COME FROM WINNING.', authorKey: 'Arnold' },
];

export default function GreetingCard() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [userName, setUserName] = useState('User');
  const { t } = useLanguage();

  useEffect(() => {
    const timer = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadUserName = async () => {
      const cachedUser = await getAuthUser();
      if (cachedUser?.name?.trim() && isMounted) {
        setUserName(cachedUser.name.trim());
      }

      try {
        const user = await fetchCurrentUser();
        if (!isMounted) {
          return;
        }

        const nextName = user?.name?.trim();
        if (nextName) {
          setUserName(nextName);
        }
      } catch {
        if (cachedUser?.name?.trim() && isMounted) {
          setUserName(cachedUser.name.trim());
        }
      }
    };

    void loadUserName();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <View style={styles.greetingSection}>
      <View style={styles.greetingRow}>
        <Text style={styles.greetingPrefix}>{t('Good morning, ')}</Text>
        <Text
          style={styles.greetingName}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {userName}
        </Text>
      </View>
      <View style={styles.quoteBox}>
        <Text style={styles.quoteText}>
          {t(QUOTES[quoteIndex].textKey)}
        </Text>
        <Text style={styles.quoteAuthor}>- {t(QUOTES[quoteIndex].authorKey)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  greetingSection: {
    backgroundColor: '#13132A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    height: 212,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    minWidth: 0,
    minHeight: 28,
  },
  greetingPrefix: {
    fontSize: 17,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
  },
  greetingName: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 21,
    color: Colors.accentBlue,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  quoteBox: {
    marginTop: 8,
    flex: 1,
    justifyContent: 'space-between',
  },
  quoteText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 27,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    maxHeight: 96,
  },
  quoteAuthor: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 12,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
  },
});
