import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
  Keyboard,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, Phone } from 'lucide-react-native';
import { useAuthState } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '../context/I18nProvider';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthState();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (err: any) {
      // Don't leak server internals — normalize the error string.
      const msg = typeof err?.message === 'string' ? err.message : '';
      if (/invalid|credential|password|401|unauthorized/i.test(msg)) {
        setError('Invalid email or password');
      } else if (msg) {
        setError(msg);
      } else {
        setError('Could not sign in. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuth = (provider: 'Google' | 'Apple' | 'Facebook' | 'Phone') => {
    Alert.alert(
      `${provider} sign-in coming soon`,
      `Sign in with ${provider} will be available in the next release. ` +
        'For now, please use your email and password, or create an account.',
      [{ text: 'OK' }],
    );
  };

  const handleForgotPassword = async () => {
    if (!EMAIL_RE.test(forgotEmail.trim())) {
      Alert.alert('Enter your email', 'Please enter the email address linked to your Vellum account.');
      return;
    }
    setForgotBusy(true);
    Keyboard.dismiss();
    try {
      await apiClient.forgotPassword(forgotEmail.trim());
      setForgotDone(true);
    } catch (err: any) {
      Alert.alert(
        'Could not request reset',
        typeof err?.message === 'string' ? err.message : 'Please try again in a moment.',
      );
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']}
      style={{ flex: 1, backgroundColor: '#f7f4ee' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Instagram-style centered logo */}
          <View style={{ alignItems: 'center', marginTop: 48, marginBottom: 40 }}>
            <Text
              style={{
                fontFamily: 'Georgia',
                fontStyle: 'italic',
                fontSize: 48,
                fontWeight: '700',
                color: '#000000',
                letterSpacing: -1,
              }}
            >
              Vellum.
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: '#666666',
                marginTop: 8,
              }}
            >
              {t('emptyStates.signInToContinue')}
            </Text>
          </View>

          {/* Error */}
          {error && (
            <View
              style={{
                backgroundColor: '#fef2f2',
                padding: 12,
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <Text style={{ color: '#dc2626', fontSize: 14 }}>{error}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={{ marginBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e5e5',
                paddingHorizontal: 14,
                height: 52,
              }}
            >
              <Mail size={18} color="#999999" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.email')}
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e5e5',
                paddingHorizontal: 14,
                height: 52,
              }}
            >
              <Lock size={18} color="#999999" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.password')}
                placeholderTextColor="#999999"
                secureTextEntry={!showPassword}
                autoCorrect={false}
                style={{
                  flex: 1,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={{ padding: 4 }}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#999999" />
                ) : (
                  <Eye size={18} color="#999999" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password */}
          <View style={{ alignItems: 'flex-end', marginBottom: 24 }}>
            <TouchableOpacity
              onPress={() => {
                setForgotEmail(email.trim());
                setForgotDone(false);
                setForgotOpen(true);
              }}
            >
              <Text style={{ color: '#d97706', fontSize: 13, fontWeight: '500' }}>
                {t('auth.forgotPassword')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            style={{
              backgroundColor: '#000000',
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              marginBottom: 24,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                {t('auth.signIn')}
              </Text>
            )}
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e5e5' }} />
            <Text style={{ color: '#999999', fontSize: 13, marginHorizontal: 16, fontWeight: '500' }}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: '#e5e5e5' }} />
          </View>

          {/* Social Login Options */}
          {/* Google */}
          <TouchableOpacity
            onPress={() => handleOAuth('Google')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e5e5',
              marginBottom: 10,
            }}
            activeOpacity={0.7}
            accessibilityLabel="Continue with Google"
          >
            <Text style={{ fontSize: 20, marginRight: 10 }}>G</Text>
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity
            onPress={() => handleOAuth('Apple')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e5e5',
              marginBottom: 10,
            }}
            activeOpacity={0.7}
            accessibilityLabel="Continue with Apple"
          >
            <Text style={{ fontSize: 20, marginRight: 10 }}>{'\uF8FF'}</Text>
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Apple
            </Text>
          </TouchableOpacity>

          {/* Facebook */}
          <TouchableOpacity
            onPress={() => handleOAuth('Facebook')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e5e5',
              marginBottom: 10,
            }}
            activeOpacity={0.7}
            accessibilityLabel="Continue with Facebook"
          >
            <Text style={{ fontSize: 20, marginRight: 10, color: '#1877F2' }}>f</Text>
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Facebook
            </Text>
          </TouchableOpacity>

          {/* Phone */}
          <TouchableOpacity
            onPress={() => handleOAuth('Phone')}
            style={{
              flexDirection: 'row',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#ffffff',
              paddingVertical: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e5e5e5',
              marginBottom: 32,
            }}
            activeOpacity={0.7}
            accessibilityLabel="Continue with Phone"
          >
            {/* <Text style={{ fontSize: 18, marginRight: 10 }}>{'\u260E'}</Text> */}
            <Phone size={18} color="#000000" />
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Phone
            </Text>
          </TouchableOpacity>

          {/* Register Link */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: '#e5e5e5',
            }}
          >
            <Text style={{ color: '#666666', fontSize: 14 }}>New to Vellum? </Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#d97706', fontSize: 14, fontWeight: '600' }}>
                  Create Account
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot password modal */}
      <Modal
        visible={forgotOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotOpen(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            padding: 24,
            justifyContent: 'center',
          }}
          activeOpacity={1}
          onPress={() => !forgotBusy && !forgotDone && setForgotOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#f7f4ee',
              borderRadius: 20,
              padding: 24,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 16,
            }}
          >
            <Text
              style={{
                fontFamily: 'Georgia',
                fontStyle: 'italic',
                fontSize: 24,
                marginBottom: 8,
                color: '#000000',
              }}
            >
              {t('auth.resetPassword')}
            </Text>
            {forgotDone ? (
              <>
                <Text style={{ color: '#333333', fontSize: 15, marginBottom: 16 }}>
                  If an account exists for {forgotEmail}, we've emailed you a link to reset your password.
                  It expires in 1 hour.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setForgotOpen(false);
                    setForgotDone(false);
                  }}
                  style={{
                    backgroundColor: '#000000',
                    borderRadius: 12,
                    paddingVertical: 14,
                    alignItems: 'center',
                    marginTop: 4,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>
                    Got it
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ color: '#555555', fontSize: 14, marginBottom: 16 }}>
                  Enter your email and we'll send you a secure reset link.
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#e5e5e5',
                    paddingHorizontal: 14,
                    height: 50,
                    marginBottom: 16,
                  }}
                >
                  <Mail size={18} color="#999999" />
                  <TextInput
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#999999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!forgotBusy}
                    style={{
                      flex: 1,
                      paddingHorizontal: 10,
                      fontSize: 16,
                      color: '#000000',
                    }}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#f0ebe2',
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                    }}
                    onPress={() => setForgotOpen(false)}
                    disabled={forgotBusy}
                  >
                    <Text style={{ color: '#333333', fontWeight: '600', fontSize: 14 }}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{
                      flex: 2,
                      backgroundColor: '#d4653a',
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 8,
                    }}
                    onPress={handleForgotPassword}
                    disabled={forgotBusy}
                  >
                    {forgotBusy ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : null}
                    <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                      {forgotBusy ? 'Sending...' : 'Send reset link'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
