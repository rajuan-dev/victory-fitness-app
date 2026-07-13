import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { fetchCurrentUser, fetchHomepageQuote, getAuthUser } from '../../lib/api';
import { useLanguage } from '../../lib/i18n';

export default function GreetingCard() {
  const [userName, setUserName] = useState('User');
  const [remoteQuote, setRemoteQuote] = useState<{ text: string; author: string } | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    void fetchHomepageQuote().then((quote) => {
      if (isMounted && quote?.text && quote.author) {
        setRemoteQuote({ text: quote.text, author: quote.author });
      }
    }).catch(() => undefined);
    return () => { isMounted = false; };
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
          {remoteQuote?.text || ''}
        </Text>
        {remoteQuote?.author ? <Text style={styles.quoteAuthor}>- {remoteQuote.author}</Text> : null}
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
