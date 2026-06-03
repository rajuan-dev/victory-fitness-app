import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../lib/i18n';

export default function InviteFriendsCard() {
  const { t } = useLanguage();
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

      <TouchableOpacity style={styles.premiumInviteBtn} activeOpacity={0.85}>
        <Text style={styles.premiumInviteBtnText}>{t('Invite Friends')}</Text>
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
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    fontFamily: 'Inter_700Bold',
  },
  premiumInviteDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 21,
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
  premiumInviteBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', fontFamily: 'Inter_700Bold' },
});
