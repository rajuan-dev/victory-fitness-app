import React, { useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  TouchableOpacity,
  Text,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

export type AllowedInputType = 'string' | 'number' | 'decimal' | 'both';

export interface AuthInputProps extends TextInputProps {
  icon?: keyof typeof Ionicons.glyphMap;
  allowedType?: AllowedInputType;
  label?: string;
  error?: string;
}

export function sanitizeInput(text: string, type: AllowedInputType): string {
  if (!text) return '';
  switch (type) {
    case 'string':
      // Strip numeric digits (0-9). Numbers cannot be typed in string-only fields.
      return text.replace(/[0-9]/g, '');
    case 'number':
      // Strip all non-digit characters. Strings/letters cannot be typed in number-only fields.
      return text.replace(/\D/g, '');
    case 'decimal':
      // Strip non-numeric non-dot characters. Allow only digits and maximum 1 decimal point.
      return text
        .replace(/[^0-9.]/g, '')
        .replace(/(\..*)\./g, '$1');
    case 'both':
    default:
      return text;
  }
}

export const AuthInput: React.FC<AuthInputProps> = ({
  secureTextEntry,
  allowedType = 'both',
  label,
  error,
  icon,
  onChangeText,
  value,
  keyboardType,
  style,
  placeholder,
  ...props
}) => {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);

  const handleTextChange = (text: string) => {
    const sanitized = sanitizeInput(text, allowedType);
    if (onChangeText) {
      onChangeText(sanitized);
    }
  };

  // Determine standard keyboardType default based on allowedType if not explicitly passed
  let computedKeyboardType = keyboardType;
  if (!computedKeyboardType) {
    if (allowedType === 'number') {
      computedKeyboardType = 'number-pad';
    } else if (allowedType === 'decimal') {
      computedKeyboardType = 'decimal-pad';
    }
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          Boolean(error) && styles.inputWrapperError,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={isFocused ? Colors.primary : Colors.textMuted}
            style={styles.leadingIcon}
          />
        ) : null}

        <TextInput
          style={[styles.input, icon ? styles.inputWithLeadingIcon : null, style]}
          placeholder={placeholder}
          placeholderTextColor={Colors.placeholder}
          secureTextEntry={isSecure}
          autoCapitalize="none"
          keyboardType={computedKeyboardType}
          value={value}
          onChangeText={handleTextChange}
          onFocus={(e) => {
            setIsFocused(true);
            if (props.onFocus) props.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            if (props.onBlur) props.onBlur(e);
          }}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsSecure(!isSecure)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel={isSecure ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={isSecure ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={!isSecure ? Colors.primary : isFocused ? Colors.primary : Colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={14} color="#EF4444" style={styles.errorIcon} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  inputWrapper: {
    width: '100%',
    height: 56,
    backgroundColor: 'rgba(26, 26, 46, 0.75)',
    borderRadius: 16,
    paddingLeft: 18,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapperFocused: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(26, 32, 54, 0.9)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inputWrapperError: {
    borderColor: '#EF4444',
  },
  leadingIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: 15,
    color: Colors.text,
    fontFamily: 'Inter_400Regular',
    paddingRight: 6,
    paddingVertical: 0,
    outlineStyle: 'none' as any,
  },
  inputWithLeadingIcon: {
    paddingLeft: 0,
  },
  eyeButton: {
    height: '100%',
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    paddingLeft: 4,
  },
  errorIcon: {
    marginRight: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    fontFamily: 'Inter_400Regular',
  },
});
