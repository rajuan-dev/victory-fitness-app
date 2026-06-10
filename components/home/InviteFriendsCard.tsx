import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../lib/i18n';

export default function InviteFriendsCard() {
  const { t } = useLanguage();
  const [sharing, setSharing] = useState(false);

  const inviteUrl =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'https://victory-fitness-app.vercel.app';

  const inviteMessage = `${t('Join me on Victory Fitness and start training with me.')}\n${inviteUrl}`;

  const handleInviteFriends = async () => {
    if (sharing) {
      return;
    }

    setSharing(true);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Victory Fitness',
          text: t('Join me on Victory Fitness and start training with me.'),
          url: inviteUrl,
        });
        return;
      }

      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
        Alert.alert(t('Invite link copied'), t('The Victory Fitness invite link was copied to your clipboard.'));
        return;
      }

      await Share.share({
        message: inviteMessage,
        url: inviteUrl,
      });
    } catch (error) {
      Alert.alert(t('Invite failed'), error instanceof Error ? error.message : t('Unable to share the invite link right now.'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <View
      style={[styles.premiumInviteCard, { backgroundColor: Colors.accentPurple }]}
    >
      <View style={styles.inviteTopRow}>
        <View style={styles.inviteFriendsIcon}>
          <Ionicons name="people-outline" size={28} color="rgba(255,255,255,0.85)" />
        </View>
        <View style={styles.goldBadge}>
          <Text style={styles.goldBadgeText}>+100 {t('Points')}</Text>
        </View>
      </View>

      <Text style={styles.premiumInviteTitle}>{t("Don't train alone!")}</Text>
      <Text style={styles.premiumInviteDesc}>
        {t('Bring your friends to Victory Fitness. Motivate each other and earn points for the next rank.')}
      </Text>

      <TouchableOpacity style={styles.premiumInviteBtn} activeOpacity={0.85} onPress={() => void handleInviteFriends()}>
        <Text style={styles.premiumInviteBtnText}>{sharing ? t('Sharing...') : t('Invite Friends')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  premiumInviteCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
  },
  inviteTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  inviteFriendsIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  goldBadgeText: { color: '#000', fontSize: 13, fontWeight: '800' },
  premiumInviteTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Inter_700Bold',
  },
  premiumInviteDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: 20,
    fontFamily: 'Inter_400Regular',
  },
  premiumInviteBtn: {
    backgroundColor: '#4F8EF7',
    borderRadius: 14,
    paddingVertical: 15,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#4F8EF7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  premiumInviteBtnText: { color: '#fff', fontSize: 13, fontWeight: '800', fontFamily: 'Inter_700Bold' },
});
