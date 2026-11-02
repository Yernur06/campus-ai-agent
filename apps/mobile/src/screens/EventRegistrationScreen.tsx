import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import TopActions from '../components/TopActions';
import { translations } from '../constants/translations';
import { useApp } from '../context/AppContext';
import type { RootStackParamList } from '../types/navigation';

export type EventType = 'Хакатон' | 'Семинар' | 'Шеберлік сабағы' | '';

export type FormErrors = {
  fullName?: string;
  group?: string;
  eventType?: string;
  eventDate?: string;
  participants?: string;
  comment?: string;
  accepted?: string;
};

export const eventTypeOptions = ['Хакатон', 'Семинар', 'Шеберлік сабағы'] as const;

const isRealDate = (value: string): boolean => {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);

  if (!match) {
    return false;
  }

  const [yearPart, monthPart, dayPart] = value.split('-').map(Number);
  const date = new Date(yearPart, monthPart - 1, dayPart);

  return (
    date.getFullYear() === yearPart &&
    date.getMonth() + 1 === monthPart &&
    date.getDate() === dayPart
  );
};

type EventRegistrationScreenProps = NativeStackScreenProps<RootStackParamList, 'EventRegistration'>;

export default function EventRegistrationScreen({ navigation }: EventRegistrationScreenProps) {
  const { theme, themeName, language } = useApp();
  const t = translations[language];
  const [fullName, setFullName] = useState('');
  const [group, setGroup] = useState('');
  const [eventType, setEventType] = useState<EventType>('');
  const [eventDate, setEventDate] = useState('');
  const [participants, setParticipants] = useState('1');
  const [comment, setComment] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((current) => {
      const next = { ...current };
      next[field] = undefined;
      return next;
    });
  };

  const eventTypeChoices = [
    { value: 'Хакатон' as const, label: t.eventRegistration.eventTypeOptions.hackathon },
    { value: 'Семинар' as const, label: t.eventRegistration.eventTypeOptions.seminar },
    { value: 'Шеберлік сабағы' as const, label: t.eventRegistration.eventTypeOptions.workshop }
  ];

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = t.eventRegistration.validation.fullNameRequired;
    } else if (fullName.trim().length < 3) {
      nextErrors.fullName = t.eventRegistration.validation.fullNameMin;
    }

    if (!group.trim()) {
      nextErrors.group = t.eventRegistration.validation.groupRequired;
    }

    if (!eventType) {
      nextErrors.eventType = t.eventRegistration.validation.eventTypeRequired;
    }

    if (!eventDate) {
      nextErrors.eventDate = t.eventRegistration.validation.dateFormat;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      nextErrors.eventDate = t.eventRegistration.validation.dateFormat;
    } else if (!isRealDate(eventDate)) {
      nextErrors.eventDate = t.eventRegistration.validation.dateReal;
    } else {
      const [year, month, day] = eventDate.split('-').map(Number);
      const eventDay = new Date(year, month - 1, day);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (eventDay < today) {
        nextErrors.eventDate = t.eventRegistration.validation.datePast;
      }
    }

    if (!participants.trim()) {
      nextErrors.participants = t.eventRegistration.validation.participantsRequired;
    } else {
      const parsedParticipants = Number(participants);

      if (!Number.isInteger(parsedParticipants) || parsedParticipants < 1 || parsedParticipants > 5) {
        nextErrors.participants = t.eventRegistration.validation.participantsRange;
      }
    }

    if (!comment.trim()) {
      nextErrors.comment = t.eventRegistration.validation.commentRequired;
    } else if (comment.trim().length < 10) {
      nextErrors.comment = t.eventRegistration.validation.commentMin;
    }

    if (!accepted) {
      nextErrors.accepted = t.eventRegistration.validation.accepted;
    }

    return nextErrors;
  };

  const handleSubmit = () => {
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    Alert.alert(t.eventRegistration.successTitle, t.eventRegistration.successMessage);
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={[styles.container, { padding: theme.spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <TopActions showLogout={false} />

          <View style={styles.headerBlock}>
            <Text style={[styles.title, { color: theme.colors.text }]}>{t.eventRegistration.title}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.mutedText }]}>{t.eventRegistration.subtitle}</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t.eventRegistration.fullNameLabel}</Text>
            <TextInput
              value={fullName}
              onChangeText={(value) => {
                setFullName(value);
                clearFieldError('fullName');
              }}
              placeholder={t.profile.fields.fullName}
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="words"
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  borderColor: errors.fullName ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            />
            {errors.fullName ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.fullName}</Text> : null}

            <Text style={[styles.label, { color: theme.colors.text }]}>{t.eventRegistration.groupLabel}</Text>
            <TextInput
              value={group}
              onChangeText={(value) => {
                setGroup(value);
                clearFieldError('group');
              }}
              placeholder={t.profile.fields.group}
              placeholderTextColor={theme.colors.placeholder}
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  borderColor: errors.group ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            />
            {errors.group ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.group}</Text> : null}

            <Text style={[styles.label, { color: theme.colors.text }]}>{t.eventRegistration.eventTypeLabel}</Text>
            <View style={styles.eventTypeGroup}>
              {eventTypeChoices.map((option) => {
                const isSelected = eventType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => {
                      setEventType(option.value);
                      clearFieldError('eventType');
                    }}
                    style={[
                      styles.eventTypeOption,
                      {
                        backgroundColor: isSelected ? theme.colors.selected : theme.colors.surface,
                        borderColor: errors.eventType ? theme.colors.error : isSelected ? theme.colors.primary : theme.colors.border
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.eventTypeText,
                        { color: isSelected ? theme.colors.text : theme.colors.mutedText }
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.eventType ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.eventType}</Text> : null}

            <Text style={[styles.label, { color: theme.colors.text }]}>{t.eventRegistration.dateLabel}</Text>
            <TextInput
              value={eventDate}
              onChangeText={(value) => {
                setEventDate(value);
                clearFieldError('eventDate');
              }}
              placeholder={t.eventRegistration.datePlaceholder}
              placeholderTextColor={theme.colors.placeholder}
              autoCapitalize="none"
              keyboardType="numeric"
              maxLength={10}
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  borderColor: errors.eventDate ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            />
            {errors.eventDate ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.eventDate}</Text> : null}

            <Text style={[styles.label, { color: theme.colors.text }]}>{t.eventRegistration.participantsLabel}</Text>
            <TextInput
              value={participants}
              onChangeText={(value) => {
                setParticipants(value);
                clearFieldError('participants');
              }}
              placeholder={t.eventRegistration.participantsPlaceholder}
              placeholderTextColor={theme.colors.placeholder}
              keyboardType="number-pad"
              maxLength={1}
              style={[
                styles.input,
                {
                  color: theme.colors.text,
                  borderColor: errors.participants ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            />
            {errors.participants ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.participants}</Text> : null}

            <Text style={[styles.label, { color: theme.colors.text }]}>{t.eventRegistration.commentLabel}</Text>
            <TextInput
              value={comment}
              onChangeText={(value) => {
                setComment(value);
                clearFieldError('comment');
              }}
              placeholder={t.eventRegistration.commentPlaceholder}
              placeholderTextColor={theme.colors.placeholder}
              multiline
              maxLength={200}
              numberOfLines={5}
              textAlignVertical="top"
              style={[
                styles.textArea,
                {
                  color: theme.colors.text,
                  borderColor: errors.comment ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            />
            {errors.comment ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.comment}</Text> : null}

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted }}
              onPress={() => {
                setAccepted((current) => !current);
                clearFieldError('accepted');
              }}
              style={[
                styles.checkboxRow,
                {
                  borderColor: errors.accepted ? theme.colors.error : theme.colors.border,
                  backgroundColor: theme.colors.surface
                }
              ]}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: errors.accepted ? theme.colors.error : theme.colors.border,
                    backgroundColor: accepted ? theme.colors.primary : 'transparent'
                  }
                ]}
              >
                {accepted ? <Text style={[styles.checkmark, { color: theme.colors.background }]}>✓</Text> : null}
              </View>
              <Text style={[styles.checkboxLabel, { color: theme.colors.text }]}>{t.eventRegistration.acceptedLabel}</Text>
            </Pressable>
            {errors.accepted ? <Text style={[styles.errorText, { color: theme.colors.error }]}>{errors.accepted}</Text> : null}

            <Pressable
              onPress={() => {
                handleSubmit();
              }}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: pressed ? theme.colors.primaryPressed : theme.colors.primary }
              ]}
            >
              <Text style={[styles.submitText, { color: themeName === 'dark' ? '#161616' : '#FFFDF7' }]}>
                {t.eventRegistration.submit}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  container: { flexGrow: 1 },
  headerBlock: { marginTop: 12, marginBottom: 18 },
  eyebrow: { fontSize: 12, letterSpacing: 1.5, fontWeight: '700', marginBottom: 8 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24 },
  form: { width: '100%', maxWidth: 540, alignSelf: 'center' },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 12 },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16
  },
  textArea: {
    minHeight: 110,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  eventTypeGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  eventTypeOption: {
    flexBasis: '31%',
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12
  },
  eventTypeText: { fontSize: 14, textAlign: 'center', fontWeight: '600' },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 12
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  checkmark: { fontSize: 16, fontWeight: '800' },
  checkboxLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  errorText: { marginTop: 6, fontSize: 12, fontWeight: '600' },
  submitButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12
  },
  submitText: { fontSize: 16, fontWeight: '800' }
});
