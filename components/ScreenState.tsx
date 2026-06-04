import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

type ScreenStateProps = {
  mode: 'loading' | 'error' | 'empty';
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
  spinnerColor?: string;
};

export function ScreenState({
  mode,
  title,
  message,
  actionLabel,
  onAction,
  iconName,
  iconColor,
  spinnerColor,
}: ScreenStateProps) {
  return (
    <View style={styles.container}>
      {mode === 'loading' ? (
        <ActivityIndicator size="large" color={spinnerColor ?? Colors.accentBlue} />
      ) : (
        <Ionicons
          name={iconName ?? (mode === 'error' ? 'alert-circle-outline' : 'document-text-outline')}
          size={34}
          color={iconColor ?? (mode === 'error' ? '#FCA5A5' : Colors.textMuted)}
        />
      )}

      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={[styles.message, mode === 'error' && styles.errorMessage]}>{message}</Text>

      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.actionButton} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    fontFamily: 'Inter_700Bold',
  },
  message: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
  },
  errorMessage: {
    color: '#FCA5A5',
    fontFamily: 'Inter_500Medium',
  },
  actionButton: {
    marginTop: 4,
    minWidth: 132,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 182, 212, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: Colors.accentBlue,
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
