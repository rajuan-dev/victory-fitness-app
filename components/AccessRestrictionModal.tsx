import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

type AccessRestrictionModalProps = {
  visible: boolean;
  sectionName: string;
  onClose: () => void;
  onUpdatePlan: () => void;
  onBackHome: () => void;
};

export default function AccessRestrictionModal({
  visible,
  sectionName,
  onClose,
  onUpdatePlan,
  onBackHome,
}: AccessRestrictionModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="lock-closed" size={18} color={Colors.accentGold} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.72)" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Access Restricted</Text>
          <Text style={styles.message}>
            You can&apos;t access {sectionName} with your current plan. Update your plan to unlock this section.
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onUpdatePlan} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Update Plan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onBackHome} activeOpacity={0.85}>
              <Text style={styles.secondaryBtnText}>Back Home</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,8,20,0.76)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#13132A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.24)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    marginBottom: 10,
  },
  message: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  actions: {
    gap: 12,
    marginTop: 24,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#04111F',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
