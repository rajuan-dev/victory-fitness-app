import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../lib/i18n';

const days = [
  { name: 'MON', active: true },
  { name: 'TUE', active: true },
  { name: 'WED', active: true },
  { name: 'THU', active: true },
  { name: 'FRI', active: true },
  { name: 'SAT', active: false },
  { name: 'SUN', active: false },
];

export default function AccountabilitySection() {
  const { t } = useLanguage();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.accountabilityTitle}>{t('Accountability')}</Text>
        <View style={styles.accountabilityIcons}>
          <Ionicons name="chatbubble-outline" size={24} color={Colors.accentBlue} />
          <Ionicons name="add" size={24} color={Colors.accentBlue} style={{ marginLeft: 16 }} />
        </View>
      </View>

      <View style={styles.accountabilityCard}>
        <View style={styles.accountabilityTopRow}>
          <View style={styles.streakWrapper}>
            <View style={styles.streakAddBtn}>
              <Ionicons name="fitness" size={16} color={Colors.accentPurple} />
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.streakSub}>{t('STREAK')}</Text>
              <Text style={styles.streakVal}>{t('0 Days')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.atRiskBtn} activeOpacity={0.8}>
            <Text style={styles.atRiskText}>{t('STREAK AT RISK!')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.milestoneContainer}>
          <View style={styles.milestoneTextRow}>
            <Text style={styles.milestoneLabel}>{t('NEXT MILESTONE: 3 DAYS')}</Text>
            <Text style={styles.milestonePercent}>0%</Text>
          </View>
          <View style={styles.dividerSubtle} />
          <View style={styles.modernProgressBg}>
            <View style={[styles.modernProgressFill, { width: '0%' }]} />
          </View>
        </View>

        <View style={styles.modernDaysRow}>
          {days.map((d, i) => (
            <View key={i} style={styles.modernDayItem}>
              <Text style={[styles.modernDayLabel, d.active && { color: Colors.accentBlue }]}>
                {d.name}
              </Text>
              <View style={[styles.modernDayDot, d.active && styles.modernDayDotActive]} />
            </View>
          ))}
        </View>

        <View style={styles.championsBannerPill}>
          <View style={styles.avatarStack}>
            <View style={[styles.avatarMini, { backgroundColor: '#444' }]} />
            <View style={[styles.avatarMini, { backgroundColor: '#666', marginLeft: -8 }]} />
            <View style={[styles.avatarMini, { backgroundColor: '#888', marginLeft: -8 }]} />
          </View>
          <Text style={styles.championsBannerText}>
            <Text style={{ color: Colors.accentBlue, fontWeight: '700' }}>1,270</Text> {t('CHAMPIONS TRAINING TODAY')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  accountabilityTitle: { fontSize: 24, fontWeight: '800', color: Colors.accentBlue, fontFamily: 'Inter_700Bold' },
  accountabilityIcons: { flexDirection: 'row', alignItems: 'center' },
  accountabilityCard: {
    backgroundColor: '#1E2530',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  accountabilityTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  streakWrapper: { flexDirection: 'row', alignItems: 'center' },
  streakAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 14,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  streakSub: { color: Colors.textMuted, fontSize: 12, fontWeight: '500', letterSpacing: 1 },
  streakVal: { color: '#fff', fontSize: 12, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  atRiskBtn: {
    backgroundColor: Colors.accentPurple,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  atRiskText: { color: '#fff', fontSize: 8, fontWeight: '900', letterSpacing: 1, fontFamily: 'Inter_700Bold' },
  milestoneContainer: { marginBottom: 24 },
  milestoneTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  dividerSubtle: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 16 },
  milestoneLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  milestonePercent: { color: Colors.accentBlue, fontSize: 14, fontWeight: '700' },
  modernProgressBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
  modernProgressFill: {
    height: '100%',
    backgroundColor: Colors.accentBlue,
    borderRadius: 4,
    shadowColor: Colors.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  modernDaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  modernDayItem: { alignItems: 'center' },
  modernDayLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8 },
  modernDayDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)' },
  modernDayDotActive: {
    backgroundColor: Colors.accentBlue,
    shadowColor: Colors.accentBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  championsBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 12,
    justifyContent: 'center',
  },
  avatarStack: { flexDirection: 'row', marginRight: 12 },
  avatarMini: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#151528' },
  championsBannerText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
});
