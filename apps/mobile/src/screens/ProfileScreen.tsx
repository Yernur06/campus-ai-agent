import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import ProfilePhoto from '../components/ProfilePhoto';
import TopActions from '../components/TopActions';
import { translations } from '../constants/translations';
import { useApp } from '../context/AppContext';
import type { AcademicStatus, Gender, StudyForm, StudyLanguage, StudentProfile } from '../types/student';
import type { MainTabParamList, RootStackParamList } from '../types/navigation';

type ProfileScreenProps = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

type ProfileFieldProps = {
  label: string;
  value: string;
  emptyValue: string;
  theme: ReturnType<typeof useApp>['theme'];
  editing: boolean;
  onChangeText?: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  secureTextEntry?: boolean;
  trailing?: ReactNode;
  trailingBelow?: boolean;
};

function ProfileField({
  label,
  value,
  emptyValue,
  theme,
  editing,
  onChangeText,
  keyboardType = 'default',
  maxLength,
  secureTextEntry = false,
  trailing,
  trailingBelow = false
}: ProfileFieldProps) {
  return (
    <View style={[styles.fieldCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <Text style={[styles.fieldLabel, { color: theme.colors.mutedText }]}>{label}</Text>
      <View style={styles.fieldValueRow}>
        {editing && onChangeText ? (
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            maxLength={maxLength}
            secureTextEntry={secureTextEntry}
            placeholder={emptyValue}
            placeholderTextColor={theme.colors.placeholder}
            style={[styles.fieldInput, { color: theme.colors.text, borderColor: theme.colors.border }]}
          />
        ) : (
          <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{value.trim() || emptyValue}</Text>
        )}
        {!trailingBelow ? trailing : null}
      </View>
      {trailingBelow && trailing ? <View style={styles.trailingBelow}>{trailing}</View> : null}
    </View>
  );
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { profile, account, theme, themeName, language, updateProfile, logout } = useApp();
  const [draftProfile, setDraftProfile] = useState<StudentProfile>(profile);
  const [isEditing, setIsEditing] = useState(false);
  const [isIinVisible, setIsIinVisible] = useState(false);
  const t = translations[language];
  const profileText = t.profile;

  const updateDraft = <Key extends keyof StudentProfile>(key: Key, value: StudentProfile[Key]) => {
    setDraftProfile((current) => ({ ...current, [key]: value }));
  };

  const getDisplayedIin = (iin: string) => {
    const digits = iin.replace(/\D/g, '');
    if (isIinVisible) {
      return digits || profileText.emptyValue;
    }
    const lastFour = digits.slice(-4).padStart(4, '•');
    return digits ? `•••• •••• ${lastFour}` : profileText.emptyValue;
  };

  const isValidBirthDate = (value: string) => {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (!match) {
      return false;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(0);
    date.setFullYear(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day
      && date <= today;
  };

  const handleSave = async () => {
    if (!draftProfile.fullName.trim()) {
      Alert.alert(t.errorTitle, profileText.validation.required);
      return;
    }
    if (!/^\d{12}$/.test(draftProfile.iin)) {
      Alert.alert(t.errorTitle, profileText.validation.invalidIin);
      return;
    }
    if (!draftProfile.studentId.trim()) {
      Alert.alert(t.errorTitle, profileText.validation.requiredStudentId);
      return;
    }
    if (!isValidBirthDate(draftProfile.birthDate)) {
      Alert.alert(t.errorTitle, profileText.validation.invalidBirthDate);
      return;
    }
    if (!draftProfile.group.trim()) {
      Alert.alert(t.errorTitle, profileText.validation.requiredGroup);
      return;
    }
    if (!Number.isInteger(draftProfile.course) || draftProfile.course < 1 || draftProfile.course > 6) {
      Alert.alert(t.errorTitle, profileText.validation.invalidCourse);
      return;
    }

    await updateProfile(draftProfile);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftProfile(profile);
    setIsEditing(false);
  };

  const handleLogout = async () => {
    await logout();
    const rootNavigation = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    rootNavigation?.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  const renderTextField = (
    label: string,
    value: string,
    onChangeText: (nextValue: string) => void,
    keyboardType: 'default' | 'numeric' = 'default'
  ) => (
    <ProfileField
      label={label}
      value={value}
      emptyValue={profileText.emptyValue}
      theme={theme}
      editing={isEditing}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
    />
  );

  const renderChoiceField = <Value extends string | number>(
    label: string,
    value: Value,
    choices: readonly { value: Value; label: string }[],
    onSelect: (nextValue: Value) => void
  ) => (
    <ProfileField
      label={label}
      value={choices.find((choice) => choice.value === value)?.label ?? profileText.emptyValue}
      emptyValue={profileText.emptyValue}
      theme={theme}
      editing={isEditing}
      trailing={isEditing ? (
        <View style={styles.choiceList}>
          {choices.map((choice) => (
            <Pressable
              key={choice.value}
              accessibilityRole="button"
              accessibilityState={{ selected: choice.value === value }}
              onPress={() => onSelect(choice.value)}
              style={[styles.choiceButton, {
                backgroundColor: choice.value === value ? theme.colors.primary : theme.colors.surfaceMuted,
                borderColor: theme.colors.border
              }]}
            >
              <Text style={[styles.choiceText, {
                color: choice.value === value ? theme.colors.background : theme.colors.text
              }]}>
                {choice.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : undefined}
      trailingBelow
    />
  );

  const iinAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isIinVisible ? profileText.actions.hideIin : profileText.actions.showIin}
      onPress={() => setIsIinVisible((visible) => !visible)}
      style={[styles.iinButton, { borderColor: theme.colors.border }]}
    >
      <Text style={[styles.iinButtonText, { color: theme.colors.primary }]}>
        {isIinVisible ? profileText.actions.hideIin : profileText.actions.showIin}
      </Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView style={[styles.keyboardContainer, { backgroundColor: theme.colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: theme.colors.background, padding: theme.spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <StatusBar style={themeName === 'dark' ? 'light' : 'dark'} />
        <TopActions showLogout={false} />

      <Text style={[styles.screenTitle, { color: theme.colors.text }]}>{profileText.studentTitle}</Text>
      <ProfilePhoto
        value={draftProfile.photoUri}
        onChange={(photoUri) => updateDraft('photoUri', photoUri)}
        editable={isEditing}
      />
      <View style={styles.profileHeader}>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: theme.colors.text }]}>{draftProfile.fullName.trim() || profileText.emptyValue}</Text>
          <Text style={[styles.headerDetail, { color: theme.colors.mutedText }]}>{draftProfile.group.trim() || profileText.emptyValue}</Text>
          <Text style={[styles.headerDetail, { color: theme.colors.mutedText }]}>
            {profileText.values.academicStatus[draftProfile.academicStatus]}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{profileText.sections.personalData}</Text>
      {renderTextField(profileText.fields.fullName, draftProfile.fullName, (value) => updateDraft('fullName', value))}
      <ProfileField
        label={profileText.fields.iin}
        value={isEditing ? draftProfile.iin : getDisplayedIin(profile.iin)}
        emptyValue={profileText.emptyValue}
        theme={theme}
        editing={isEditing}
        onChangeText={(value) => updateDraft('iin', value.replace(/\D/g, '').slice(0, 12))}
        keyboardType="number-pad"
        maxLength={12}
        secureTextEntry={isEditing && !isIinVisible}
        trailing={iinAction}
      />
      {renderTextField(profileText.fields.birthDate, draftProfile.birthDate, (value) => updateDraft('birthDate', value))}
      {renderChoiceField(
        profileText.fields.gender,
        draftProfile.gender,
        [
          { value: 'male', label: profileText.values.gender.male },
          { value: 'female', label: profileText.values.gender.female }
        ] satisfies readonly { value: Gender; label: string }[],
        (value) => updateDraft('gender', value)
      )}

      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{profileText.sections.study}</Text>
      {renderTextField(profileText.fields.studentId, draftProfile.studentId, (value) => updateDraft('studentId', value))}
      {renderTextField(profileText.fields.group, draftProfile.group, (value) => updateDraft('group', value))}
      {renderChoiceField(
        profileText.fields.course,
        draftProfile.course,
        [1, 2, 3, 4, 5, 6].map((course) => ({ value: course, label: String(course) })),
        (value) => updateDraft('course', value)
      )}
      {renderChoiceField(
        profileText.fields.studyForm,
        draftProfile.studyForm,
        [
          { value: 'fullTime', label: profileText.values.studyForm.fullTime },
          { value: 'partTime', label: profileText.values.studyForm.partTime }
        ] satisfies readonly { value: StudyForm; label: string }[],
        (value) => updateDraft('studyForm', value)
      )}
      {renderChoiceField(
        profileText.fields.studyLanguage,
        draftProfile.studyLanguage,
        [
          { value: 'kk', label: profileText.values.studyLanguage.kk },
          { value: 'ru', label: profileText.values.studyLanguage.ru },
          { value: 'en', label: profileText.values.studyLanguage.en }
        ] satisfies readonly { value: StudyLanguage; label: string }[],
        (value) => updateDraft('studyLanguage', value)
      )}
      {renderTextField(profileText.fields.specialty, draftProfile.specialty, (value) => updateDraft('specialty', value))}
      {renderTextField(profileText.fields.institute, draftProfile.institute, (value) => updateDraft('institute', value))}
      {renderTextField(profileText.fields.department, draftProfile.department, (value) => updateDraft('department', value))}
      {renderChoiceField(
        profileText.fields.academicStatus,
        draftProfile.academicStatus,
        [
          { value: 'studying', label: profileText.values.academicStatus.studying },
          { value: 'academicLeave', label: profileText.values.academicStatus.academicLeave },
          { value: 'graduate', label: profileText.values.academicStatus.graduate },
          { value: 'expelled', label: profileText.values.academicStatus.expelled }
        ] satisfies readonly { value: AcademicStatus; label: string }[],
        (value) => updateDraft('academicStatus', value)
      )}

      <View style={styles.actions}>
        {isEditing ? (
          <>
            <Pressable
              accessibilityRole="button"
              onPress={() => { void handleSave(); }}
              style={({ pressed }) => [styles.actionButton, {
                backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary
              }]}
            >
              <Text style={[styles.primaryButtonText, { color: theme.colors.background }]}>{profileText.actions.save}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={handleCancel}
              style={[styles.actionButton, styles.secondaryAction, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>{profileText.actions.cancel}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setDraftProfile(profile);
              setIsEditing(true);
            }}
            style={({ pressed }) => [styles.actionButton, {
              backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary
            }]}
          >
            <Text style={[styles.primaryButtonText, { color: theme.colors.background }]}>{profileText.actions.edit}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => { void handleLogout(); }}
          style={[styles.actionButton, styles.logoutButton, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>{t.logout}</Text>
        </Pressable>
      </View>
      <Text style={[styles.accountLogin, { color: theme.colors.mutedText }]}>
        {t.accountLabel}: {account?.login ?? t.accountUnavailable}
      </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1 },
  container: { flexGrow: 1, gap: 10 },
  screenTitle: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 16 },
  headerInfo: { flex: 1, gap: 6 },
  headerName: { fontSize: 21, fontWeight: '800' },
  headerDetail: { fontSize: 15 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginTop: 20, marginBottom: 2 },
  fieldCard: { width: '100%', padding: 14, borderWidth: 1, borderRadius: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 7 },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trailingBelow: { marginTop: 12 },
  fieldValue: { flex: 1, fontSize: 16, fontWeight: '600' },
  fieldInput: { flex: 1, minHeight: 40, borderBottomWidth: 1, paddingVertical: 4, fontSize: 16 },
  iinButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  iinButtonText: { fontSize: 12, fontWeight: '700' },
  choiceList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceButton: { minHeight: 36, justifyContent: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  choiceText: { fontSize: 13, fontWeight: '600' },
  actions: { gap: 10, marginTop: 20, marginBottom: 10 },
  actionButton: { minHeight: 50, justifyContent: 'center', alignItems: 'center', borderRadius: 12, paddingHorizontal: 18 },
  secondaryAction: { borderWidth: 1 },
  logoutButton: { borderWidth: 1 },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },
  secondaryButtonText: { fontSize: 16, fontWeight: '700' },
  accountLogin: { fontSize: 13, textAlign: 'center', marginBottom: 8 }
});
