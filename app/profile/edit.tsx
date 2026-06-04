import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { ErrorPopupModal } from '../../components/ErrorPopupModal';
import { ScreenState } from '../../components/ScreenState';
import { fetchCurrentUser, updateCurrentUserProfile, uploadCurrentUserProfileImage } from '../../lib/api';
import { formatAppError } from '../../lib/error';
import { useLanguage } from '../../lib/i18n';
import { useAsyncScreenData } from '../../hooks/useAsyncScreenData';

export default function EditProfileScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);
  const {
    loading: loadingProfile,
    error: loadError,
    reload: reloadProfile,
  } = useAsyncScreenData({
    initialData: null as null,
    load: async () => {
      const me = await fetchCurrentUser();
      setName(me.name ?? '');
      setEmail(me.email ?? '');
      setLocation(me.country ?? '');
      setProfileImage(me.profileImage ?? '');
      return null;
    },
    getErrorMessage: () => t('Unable to load your profile right now.'),
  });

  const handleSave = async () => {
    if (savingProfile) {
      return;
    }

    setSavingProfile(true);
    try {
      await updateCurrentUserProfile({
        name: name.trim(),
        email: email.trim(),
        country: location.trim(),
        profileImage: profileImage.trim() || undefined,
      });
      router.back();
    } catch (error) {
      setErrorDialog(formatAppError(error, t('Unable to save profile changes.')));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePhoto = async () => {
    if (loadingProfile || savingProfile || uploadingImage) {
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorDialog({
          title: t('Permission needed'),
          message: t('Please allow photo library access to choose a profile image.'),
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        throw new Error('The selected image could not be processed for upload.');
      }

      setUploadingImage(true);
      try {
        const response = await uploadCurrentUserProfileImage({
          image_base64: asset.base64,
          mime_type: asset.mimeType ?? 'image/jpeg',
          file_name: asset.fileName ?? null,
        });
        setProfileImage(response.image_url);
      } finally {
        setUploadingImage(false);
      }
    } catch (error) {
      setErrorDialog(formatAppError(error, t('Unable to upload your profile image right now.')));
      setUploadingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ErrorPopupModal
        visible={Boolean(errorDialog)}
        title={errorDialog?.title ?? t('Error')}
        message={errorDialog?.message ?? ''}
        onClose={() => setErrorDialog(null)}
      />
      <Stack.Screen options={{ 
        headerShown: true, 
        title: t('EDIT PROFILE'),
        headerTransparent: true,
        headerTintColor: '#fff',
        headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: 2 } as any,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 8 }}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
        ),
      }} />

      {loadingProfile ? (
        <ScreenState mode="loading" message={t('Loading your profile...')} />
      ) : loadError ? (
        <ScreenState
          mode="error"
          title={t('Profile unavailable')}
          message={loadError}
          actionLabel={t('Try Again')}
          onAction={() => void reloadProfile()}
        />
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <Image
              source={
                profileImage
                  ? { uri: profileImage }
                  : require('../../assets/profile-placeholder.png')
              }
              style={styles.avatarImage}
            />
            <TouchableOpacity
              style={[styles.cameraBtn, uploadingImage && styles.cameraBtnDisabled]}
              onPress={handleChangePhoto}
              disabled={uploadingImage || loadingProfile || savingProfile}
            >
              {uploadingImage ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
              <Ionicons name="camera" size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploadingImage || loadingProfile || savingProfile}>
            <Text style={styles.changePhotoText}>{uploadingImage ? t('Uploading photo...') : t('Change Profile Photo')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('FULL NAME')}</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('Your Name')}
              placeholderTextColor="rgba(255,255,255,0.2)"
              editable={!loadingProfile && !savingProfile}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('EMAIL ADDRESS')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('Your Email')}
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="email-address"
              editable={!loadingProfile && !savingProfile}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('LOCATION (OPTIONAL)')}</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder={t('City, Country')}
              placeholderTextColor="rgba(255,255,255,0.2)"
              editable={!loadingProfile && !savingProfile}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (loadingProfile || savingProfile) && styles.saveBtnDisabled]}
          activeOpacity={0.8}
          onPress={handleSave}
          disabled={loadingProfile || savingProfile}
        >
          {savingProfile ? (
            <View style={styles.saveBtnRow}>
              <ActivityIndicator color="#000" />
              <Text style={styles.saveBtnText}>{t('SAVING...')}</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>{loadingProfile ? t('LOADING...') : t('SAVE CHANGES')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  scrollContent: {
    paddingTop: 100,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarWrap: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.accentBlue,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentBlue,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1E1E1E',
  },
  cameraBtnDisabled: {
    opacity: 0.8,
  },
  changePhotoText: {
    color: Colors.accentBlue,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  formSection: {
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1,
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#131313',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    outlineStyle: 'none' as any,
  },
  saveBtn: {
    backgroundColor: Colors.accentBlue,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 2,
  },
});

