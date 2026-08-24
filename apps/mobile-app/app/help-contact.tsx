import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, Send, CheckCircle2, X } from 'lucide-react-native';
import { useThemeColors } from '../context/ThemeProvider';
import { useI18n } from '../context/I18nProvider';
import { sounds } from '../services/SoundService';
import { backendApi } from '../services/BackendApi';

// ─── Types ───

type CategoryKey = 'general' | 'account' | 'technical' | 'billing' | 'safety';

interface Category {
  key: CategoryKey;
  nameKey: string;
}

interface FormState {
  category: CategoryKey | null;
  subject: string;
  body: string;
}

interface FormErrors {
  category?: string;
  subject?: string;
  body?: string;
}

// ─── Constants ───

const CATEGORIES: Category[] = [
  { key: 'general', nameKey: 'settings.contactCategoryGeneral' },
  { key: 'account', nameKey: 'settings.contactCategoryAccount' },
  { key: 'technical', nameKey: 'settings.contactCategoryTechnical' },
  { key: 'billing', nameKey: 'settings.contactCategoryBilling' },
  { key: 'safety', nameKey: 'settings.contactCategorySafety' },
];

const MIN_BODY = 10;
const MAX_SUBJECT = 100;
const MAX_BODY = 5000;

// ─── Component ───

export default function HelpContactScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { t } = useI18n();

  // ─── State ───
  const [form, setForm] = useState<FormState>({
    category: null,
    subject: '',
    body: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    category: false,
    subject: false,
    body: false,
  });
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ id: string } | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const subjectInputRef = useRef<TextInput>(null);
  const bodyInputRef = useRef<TextInput>(null);

  // ─── Validation ───
  const validate = useCallback(
    (s: FormState): FormErrors => {
      const errs: FormErrors = {};
      
      if (!s.category) {
        errs.category = t('settings.contactCategoryRequired');
      }
      
      const subjectTrimmed = s.subject.trim();
      if (!subjectTrimmed) {
        errs.subject = t('settings.contactSubjectRequired');
      } else if (subjectTrimmed.length < 3) {
        errs.subject = t('settings.contactSubjectMinChars', { count: 3 });
      } else if (subjectTrimmed.length > MAX_SUBJECT) {
        errs.subject = t('settings.contactSubjectMaxChars', { count: MAX_SUBJECT });
      }
      
      const bodyTrimmed = s.body.trim();
      if (!bodyTrimmed) {
        errs.body = t('settings.contactMessageRequired');
      } else if (bodyTrimmed.length < MIN_BODY) {
        errs.body = t('settings.contactMinChars', { count: MIN_BODY });
      } else if (bodyTrimmed.length > MAX_BODY) {
        errs.body = t('settings.contactMaxChars', { count: MAX_BODY });
      }
      
      return errs;
    },
    [t]
  );

  // ─── Field Handlers ───
  const setField = useCallback(<K extends keyof FormState>(
    key: K,
    val: FormState[K]
  ) => {
    setForm((prev) => {
      const next = { ...prev, [key]: val };
      return next;
    });
    
    // Mark field as touched
    setTouched((prev) => ({ ...prev, [key]: true }));
    
    // Validate on change if submit was attempted
    if (submitAttempted) {
      setErrors((prev) => {
        const next = { ...prev };
        const validationErrors = validate({ ...form, [key]: val });
        // Only clear errors for this field
        if (key === 'category') {
          next.category = validationErrors.category;
        } else if (key === 'subject') {
          next.subject = validationErrors.subject;
        } else if (key === 'body') {
          next.body = validationErrors.body;
        }
        return next;
      });
    }
  }, [form, submitAttempted, validate]);

  // ─── Submit Handler ───
  const handleSubmit = useCallback(async () => {
    // Dismiss keyboard
    Keyboard.dismiss();
    
    // Mark all fields as touched
    setTouched({
      category: true,
      subject: true,
      body: true,
    });
    
    // Validate all fields
    const validationErrors = validate(form);
    setErrors(validationErrors);
    setSubmitAttempted(true);
    
    // Check if there are any errors
    const hasErrors = Object.keys(validationErrors).length > 0;
    
    if (hasErrors) {
      // Scroll to first error (handled by ScrollView ref)
      sounds().play('error');
      return;
    }
    
    if (!form.category) {
      setErrors({ category: t('settings.contactCategoryRequired') });
      return;
    }
    
    // Submit
    setSubmitting(true);
    sounds().play('tap');
    
    try {
      const result = await backendApi.createTicket({
        category: form.category,
        subject: form.subject.trim(),
        body: form.body.trim(),
      });
      
      setSuccess({ id: result.id });
      
      // Play success sound
      sounds().play('success');
      
      // Navigate after delay
      setTimeout(() => {
        router.replace(`/help-ticket-detail?id=${result.id}`);
      }, 1500);
      
    } catch (err: any) {
      sounds().play('error');
      Alert.alert(
        t('errors.generic'),
        err?.message || t('errors.generic'),
        [{ text: t('common.confirm'), style: 'default' }]
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, validate, router, t]);

  // ─── Reset Form ───
  const resetForm = useCallback(() => {
    setForm({
      category: null,
      subject: '',
      body: '',
    });
    setErrors({});
    setTouched({
      category: false,
      subject: false,
      body: false,
    });
    setSubmitAttempted(false);
    setCategoryOpen(false);
  }, []);

  // ─── Get Field Error ───
  const getFieldError = useCallback((field: keyof FormState): string | undefined => {
    if (!touched[field] && !submitAttempted) return undefined;
    return errors[field];
  }, [errors, touched, submitAttempted]);

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      resetForm();
    };
  }, [resetForm]);

  // ─── Success Screen ───
  if (success) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.successWrap}>
          <View style={[styles.successIcon, { backgroundColor: colors.success + '22' }]}>
            <CheckCircle2 size={48} color={colors.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
            {t('settings.contactSuccess')}
          </Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            #{success.id.slice(0, 8)}
          </Text>
          <Text style={[styles.successDesc, { color: colors.textMuted }]}>
            {t('settings.contactSuccessDesc')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Main Form ───
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('settings.contactIntroTitle')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {t('settings.contactIntroDesc')}
              </Text>
            </View>

            {/* Form Card */}
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              {/* Category Selector */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('settings.contactSelectCategory')}
                  <Text style={{ color: colors.danger }}> *</Text>
                </Text>
                
                <TouchableOpacity
                  style={[
                    styles.selectInput,
                    {
                      borderColor: getFieldError('category') ? colors.danger : colors.border,
                      backgroundColor: colors.surfaceAlt,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    sounds().play('tap');
                    setCategoryOpen((prev) => !prev);
                    if (!touched.category) {
                      setTouched((prev) => ({ ...prev, category: true }));
                    }
                  }}
                  disabled={submitting}
                >
                  <Text
                    style={[
                      styles.selectInputText,
                      { color: form.category ? colors.textPrimary : colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedCategoryLabel(form, t)}
                  </Text>
                  <ChevronDown
                    size={18}
                    color={colors.textMuted}
                    style={{ transform: [{ rotate: categoryOpen ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
                
                {categoryOpen && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surfaceAlt, borderColor: colors.separator }]}>
                    {CATEGORIES.map((c) => {
                      const isSelected = form.category === c.key;
                      return (
                        <TouchableOpacity
                          key={c.key}
                          style={[
                            styles.dropdownItem,
                            isSelected && { backgroundColor: colors.accent + '22' },
                          ]}
                          activeOpacity={0.6}
                          onPress={() => {
                            sounds().play('tap');
                            setField('category', c.key);
                            setCategoryOpen(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              { color: isSelected ? colors.accent : colors.textPrimary },
                            ]}
                          >
                            {t(c.nameKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                
                {getFieldError('category') && (
                  <Text style={[styles.errText, { color: colors.danger }]}>
                    {getFieldError('category')}
                  </Text>
                )}
              </View>

              {/* Subject */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('settings.contactSubject')}
                  <Text style={{ color: colors.danger }}> *</Text>
                </Text>
                
                <TextInput
                  ref={subjectInputRef}
                  style={[
                    styles.textInput,
                    {
                      borderColor: getFieldError('subject') ? colors.danger : colors.border,
                      backgroundColor: colors.surfaceAlt,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder={t('settings.contactSubjectPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={form.subject}
                  onChangeText={(v) => setField('subject', v)}
                  onBlur={() => setTouched((prev) => ({ ...prev, subject: true }))}
                  maxLength={MAX_SUBJECT}
                  editable={!submitting}
                  returnKeyType="next"
                  onSubmitEditing={() => bodyInputRef.current?.focus()}
                />
                
                <View style={styles.fieldFooter}>
                  {getFieldError('subject') ? (
                    <Text style={[styles.errText, { color: colors.danger }]}>
                      {getFieldError('subject')}
                    </Text>
                  ) : (
                    <Text style={[styles.counter, { color: colors.textMuted }]}>
                      {form.subject.length}/{MAX_SUBJECT}
                    </Text>
                  )}
                </View>
              </View>

              {/* Message */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {t('settings.contactMessage')}
                  <Text style={{ color: colors.danger }}> *</Text>
                </Text>
                
                <TextInput
                  ref={bodyInputRef}
                  style={[
                    styles.textArea,
                    {
                      borderColor: getFieldError('body') ? colors.danger : colors.border,
                      backgroundColor: colors.surfaceAlt,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder={t('settings.contactMessagePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={form.body}
                  onChangeText={(v) => setField('body', v)}
                  onBlur={() => setTouched((prev) => ({ ...prev, body: true }))}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  maxLength={MAX_BODY}
                  editable={!submitting}
                />
                
                <View style={styles.fieldFooter}>
                  {getFieldError('body') ? (
                    <Text style={[styles.errText, { color: colors.danger }]}>
                      {getFieldError('body')}
                    </Text>
                  ) : (
                    <Text style={[styles.counter, { color: form.body.length < MIN_BODY ? colors.warning : colors.textMuted }]}>
                      {form.body.length}/{MAX_BODY} • {t('settings.contactMinChars', { count: MIN_BODY })}
                    </Text>
                  )}
                </View>
              </View>

              {/* Required Fields Note */}
              <Text style={[styles.requiredNote, { color: colors.textMuted }]}>
                * {t('settings.contactRequiredFields')}
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: submitting || Object.keys(errors).length > 0
                    ? colors.border
                    : colors.accent,
                },
              ]}
              activeOpacity={0.8}
              disabled={submitting || Object.keys(errors).length > 0}
              onPress={handleSubmit}
            >
              {submitting ? (
                <ActivityIndicator color={colors.inverseText} size="small" />
              ) : (
                <>
                  <Send size={18} color={colors.inverseText} />
                  <Text style={[styles.submitBtnText, { color: colors.inverseText }]}>
                    {t('settings.contactSubmit')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Reset Button (hidden, for debugging) */}
            {__DEV__ && (
              <TouchableOpacity
                style={[styles.resetBtn, { borderColor: colors.border }]}
                onPress={resetForm}
              >
                <Text style={[styles.resetBtnText, { color: colors.textMuted }]}>
                  Reset Form (Dev)
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Helpers ───

const selectedCategoryLabel = (form: FormState, t: any): string => {
  if (!form.category) return t('settings.contactSelectCategory');
  const category = CATEGORIES.find((c) => c.key === form.category);
  return category ? t(category.nameKey) : t('settings.contactSelectCategory');
};

// ─── Styles ───

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 48,
    flexGrow: 1,
  },
  header: {
    paddingVertical: 16,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  card: {
    borderRadius: 14,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 48,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    minHeight: 140,
  },
  selectInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
  },
  selectInputText: {
    flex: 1,
    fontSize: 16,
  },
  dropdown: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  fieldFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  counter: {
    fontSize: 12,
    fontWeight: '400',
  },
  requiredNote: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
    fontStyle: 'italic',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
    minHeight: 52,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resetBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    opacity: 0.5,
  },
  resetBtnText: {
    fontSize: 12,
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  successSub: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  successDesc: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
});