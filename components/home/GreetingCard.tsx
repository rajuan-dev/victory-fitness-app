import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { fetchCurrentUser, getAuthUser } from '../../lib/api';

const QUOTES = [
  { text: 'WISDOM LISTENS BEFORE IT LEADS.', author: 'Victor Akko' },
  { text: 'YOUR ONLY LIMIT IS YOUR MIND.', author: 'Focus' },
  { text: 'VICTORY BELONGS TO THE MOST PERSEVERING.', author: 'Napoleon' },
  { text: 'STRENGTH DOES NOT COME FROM WINNING.', author: 'Arnold' },
];

export default function GreetingCard() {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [userName, setUserName] = useState('User');

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
        <Text style={styles.greetingPrefix}>Good morning, </Text>
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
          {QUOTES[quoteIndex].text}
        </Text>
        <Text style={styles.quoteAuthor}>- {QUOTES[quoteIndex].author}</Text>
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
    fontSize: 20,
    color: '#fff',
    fontFamily: 'Inter_400Regular',
  },
  greetingName: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    lineHeight: 24,
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
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 32,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    maxHeight: 96,
  },
  quoteAuthor: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 12,
    textAlign: 'right',
    fontFamily: 'Inter_400Regular',
  },
});
