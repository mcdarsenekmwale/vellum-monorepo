import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, AtSign, Phone, ChevronLeft } from 'lucide-react-native';
import { useAuthState } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuthState();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name || !handle || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (handle.length < 3) {
      setError('Handle must be at least 3 characters');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      await apiClient.register({ email, password, name, handle });
      await login(email, password);
      router.replace('/');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f7f4ee' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ paddingVertical: 16 }}
          >
            <ChevronLeft size={24} color="#000000" />
          </TouchableOpacity>

          {/* Instagram-style centered logo */}
          <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 32 }}>
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
              Create your account
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

          {/* Name Input */}
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
              <User size={18} color="#999999" />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor="#999999"
                style={{
                  flex: 1,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
            </View>
          </View>

          {/* Handle Input */}
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
              <AtSign size={18} color="#999999" />
              <TextInput
                value={handle}
                onChangeText={(text) => setHandle(text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                placeholder="Handle"
                placeholderTextColor="#999999"
                autoCapitalize="none"
                style={{
                  flex: 1,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
            </View>
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 4, marginLeft: 4 }}>
              Letters, numbers, and underscores only
            </Text>
          </View>

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
                placeholder="Email"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
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
                placeholder="Password (min 6 characters)"
                placeholderTextColor="#999999"
                secureTextEntry={!showPassword}
                style={{
                  flex: 1,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={18} color="#999999" />
                ) : (
                  <Eye size={18} color="#999999" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Create Account Button */}
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
                Create Account
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
          >
            <Text style={{ fontSize: 20, marginRight: 10 }}>G</Text>
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity
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
          >
            <Text style={{ fontSize: 20, marginRight: 10 }}>
              {'\uF8FF'}
            </Text>
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Apple
            </Text>
          </TouchableOpacity>

          {/* Facebook */}
          <TouchableOpacity
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
          >
            <Text style={{ fontSize: 20, marginRight: 10, color: '#1877F2' }}>
              f
            </Text>
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Facebook
            </Text>
          </TouchableOpacity>

          {/* Phone */}
          <TouchableOpacity
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
          >
            {/* <Text style={{ fontSize: 18, marginRight: 10 }}>
              {'\u260E'}
            </Text> */}
            <Phone size={18} color="#000000" />
            <Text style={{ color: '#000000', fontSize: 15, fontWeight: '500' }}>
              Continue with Phone
            </Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: '#e5e5e5',
            }}
          >
            <Text style={{ color: '#666666', fontSize: 14 }}>Already have an account? </Text>
            <Link href="/login" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#d97706', fontSize: 14, fontWeight: '600' }}>
                  Sign In
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
