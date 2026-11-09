import { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { translations } from '../constants/translations';
import { useApp } from '../context/AppContext';

const PHOTO_QUALITY = 0.8; // Compresses JPEG output; it does not set an exact file size or pixel dimensions.
const MAX_FILE_SIZE = 5 * 1024 * 1024;

type PhotoInfo = {
  uri: string;
  width: number;
  height: number;
  fileSize?: number;
};

type ProfilePhotoProps = {
  value?: string | null;
  onChange?: (uri: string | null) => void;
  editable?: boolean;
};

export default function ProfilePhoto({ value, onChange, editable = true }: ProfilePhotoProps) {
  const { theme, language } = useApp();
  const photoText = translations[language].profile.photo;
  const [internalUri, setInternalUri] = useState<string | null>(value ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState(false);
  const [photoInfo, setPhotoInfo] = useState<PhotoInfo | null>(null);
  const uri = value === undefined ? internalUri : value;
  const displayedPhotoInfo = photoInfo?.uri === uri ? photoInfo : null;

  const updateUri = (nextUri: string | null) => {
    if (value === undefined) {
      setInternalUri(nextUri);
    }
    onChange?.(nextUri);
  };

  const choosePhoto = async (source: 'camera' | 'gallery') => {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage('');
    setSettings(false);

    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setMessage(photoText.cameraPermissionDenied);
          setSettings(!permission.canAskAgain);
          return;
        }
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: PHOTO_QUALITY
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      if (!asset) {
        return;
      }

      if (asset.fileSize !== undefined && asset.fileSize > MAX_FILE_SIZE) {
        setMessage(photoText.fileTooLarge);
        return;
      }

      updateUri(asset.uri);
      setPhotoInfo({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        ...(asset.fileSize === undefined ? {} : { fileSize: asset.fileSize })
      });
      if (asset.fileSize === undefined) {
        setMessage(photoText.fileSizeUnknown);
      }
    } catch (error) {
      console.error(error);
      setMessage(photoText.photoPickerError);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(photoText.deleteTitle, photoText.deleteMessage, [
      { text: photoText.cancel, style: 'cancel' },
      {
        text: photoText.delete,
        style: 'destructive',
        onPress: () => {
          updateUri(null);
          setPhotoInfo(null);
          setMessage('');
          setSettings(false);
        }
      }
    ]);
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}>
        {uri ? (
          <Image
            accessibilityLabel={photoText.photoLabel}
            source={{ uri }}
            resizeMode="cover"
            style={styles.avatarImage}
          />
        ) : (
          <Text style={[styles.emptyText, { color: theme.colors.mutedText }]}>{photoText.noPhoto}</Text>
        )}
      </View>
      {displayedPhotoInfo ? (
        <View style={styles.info}>
          <Text style={[styles.infoText, { color: theme.colors.mutedText }]}>
            {photoText.dimensions(displayedPhotoInfo.width, displayedPhotoInfo.height)}
          </Text>
          {displayedPhotoInfo.fileSize === undefined ? null : (
            <Text style={[styles.infoText, { color: theme.colors.mutedText }]}>
              {photoText.fileSize((displayedPhotoInfo.fileSize / (1024 * 1024)).toFixed(2))}
            </Text>
          )}
        </View>
      ) : null}
      <View style={styles.buttons}>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !editable}
          onPress={() => { void choosePhoto('gallery'); }}
          style={({ pressed }) => [styles.button, {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            opacity: busy || !editable ? 0.5 : pressed ? 0.75 : 1
          }]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>{photoText.choosePhoto}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy || !editable}
          onPress={() => { void choosePhoto('camera'); }}
          style={({ pressed }) => [styles.button, {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            opacity: busy || !editable ? 0.5 : pressed ? 0.75 : 1
          }]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.text }]}>{photoText.takePhoto}</Text>
        </Pressable>
        {uri ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || !editable}
            onPress={confirmDelete}
            style={({ pressed }) => [styles.button, {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
              opacity: busy || !editable ? 0.5 : pressed ? 0.75 : 1
            }]}
          >
            <Text style={[styles.buttonText, { color: theme.colors.error }]}>{photoText.deletePhoto}</Text>
          </Pressable>
        ) : null}
      </View>
      {message ? <Text style={[styles.message, { color: theme.colors.error }]}>{message}</Text> : null}
      {settings ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => { void openSettings(); }}
          style={[styles.button, styles.settingsButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.background }]}>{photoText.openSettings}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    width: '100%',
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
    gap: 12
  },
  avatar: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarImage: { width: '100%', height: '100%' },
  emptyText: { fontSize: 15, fontWeight: '600' },
  info: { alignItems: 'center', gap: 4 },
  infoText: { fontSize: 13 },
  buttons: { width: '100%', gap: 8 },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  message: { width: '100%', fontSize: 14, textAlign: 'center' },
  settingsButton: { width: '100%', borderColor: 'transparent' }
});
