import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, AtSign, ArrowLeft } from 'lucide-react-native';
import { useAuthState } from '../hooks/useApi';
import { apiClient } from '../lib/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthState();
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
      // Auto-login after registration
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 24 }}
          >
            <ArrowLeft size={24} color="#000000" />
          </TouchableOpacity>

          {/* Logo */}
          <Text
            style={{
              fontFamily: 'Georgia',
              fontStyle: 'italic',
              fontSize: 32,
              fontWeight: '600',
              color: '#000000',
              marginBottom: 8,
            }}
          >
            Vellum.
          </Text>
          <Text style={{ fontSize: 16, color: '#666666', marginBottom: 32 }}>
            Create your account
          </Text>

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
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#000000' }}>
              Full Name
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e5e5',
                paddingHorizontal: 12,
              }}
            >
              <User size={18} color="#999999" />
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
            </View>
          </View>

          {/* Handle Input */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#000000' }}>
              Handle
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e5e5',
                paddingHorizontal: 12,
              }}
            >
              <AtSign size={18} color="#999999" />
              <TextInput
                value={handle}
                onChangeText={(text) => setHandle(text.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                placeholder="yourhandle"
                autoCapitalize="none"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
            </View>
            <Text style={{ fontSize: 12, color: '#999999', marginTop: 4 }}>
              Letters, numbers, and underscores only
            </Text>
          </View>

          {/* Email Input */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#000000' }}>
              Email
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e5e5',
                paddingHorizontal: 12,
              }}
            >
              <Mail size={18} color="#999999" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  paddingHorizontal: 10,
                  fontSize: 16,
                  color: '#000000',
                }}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#000000' }}>
              Password
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e5e5',
                paddingHorizontal: 12,
              }}
            >
              <Lock size={18} color="#999999" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min 6 characters"
                secureTextEntry={!showPassword}
                style={{
                  flex: 1,
                  paddingVertical: 14,
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
              marginBottom: 16,
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

          {/* Login Link */}
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
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
