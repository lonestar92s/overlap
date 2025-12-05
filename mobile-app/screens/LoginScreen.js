import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView
} from 'react-native';
import { Input, Button, CheckBox } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows, input } from '../styles/designTokens';

const LoginScreen = ({ navigation }) => {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      const result = await login(email.trim().toLowerCase(), password, rememberMe);
      
      if (result.success) {
        // Navigation will be handled by App.js based on auth state
        Alert.alert('Success', 'Welcome back!');
      } else {
        Alert.alert('Login Failed', result.error || 'Please check your credentials');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const navigateToRegister = () => {
    navigation.navigate('Register');
  };

  const handleWorkOSLogin = () => {
    // Navigate to WebView screen for in-app authentication
    navigation.navigate('WorkOSLogin');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <MaterialIcons name="sports-soccer" size={80} color={colors.primary} />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your football journey</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<MaterialIcons name="email" size={20} color={colors.text.secondary} />}
              errorMessage={errors.email}
              containerStyle={styles.inputContainer}
              inputStyle={styles.input}
              labelStyle={styles.label}
              accessibilityLabel="Email input"
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              leftIcon={<MaterialIcons name="lock" size={20} color={colors.text.secondary} />}
              rightIcon={
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                >
                  <MaterialIcons 
                    name={showPassword ? "visibility-off" : "visibility"} 
                    size={20} 
                    color={colors.text.secondary} 
                  />
                </TouchableOpacity>
              }
              errorMessage={errors.password}
              containerStyle={styles.inputContainer}
              inputStyle={styles.input}
              labelStyle={styles.label}
              accessibilityLabel="Password input"
            />

            <View style={styles.passwordActionsContainer}>
              <View style={styles.rememberMeContainer}>
                <CheckBox
                  title="Remember me"
                  checked={rememberMe}
                  onPress={() => setRememberMe(!rememberMe)}
                  containerStyle={styles.checkboxContainer}
                  textStyle={styles.checkboxText}
                  checkedColor={colors.primary}
                  uncheckedColor={colors.text.secondary}
                  accessibilityLabel="Remember me checkbox"
                />
              </View>
              <TouchableOpacity 
                onPress={() => navigation.navigate('ForgotPassword')}
                accessibilityLabel="Forgot password"
                accessibilityRole="link"
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              buttonStyle={styles.loginButton}
              titleStyle={styles.buttonTitle}
              containerStyle={styles.buttonContainer}
              accessibilityLabel="Sign in button"
              accessibilityRole="button"
            />

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleWorkOSLogin}
              disabled={loading}
              accessibilityLabel="Continue with Gmail"
              accessibilityRole="button"
            >
              <MaterialIcons name="mail" size={20} color={colors.onPrimary} style={styles.googleIcon} />
              <Text style={styles.googleButtonText}>Continue with Gmail</Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity 
                onPress={navigateToRegister}
                accessibilityLabel="Sign up"
                accessibilityRole="link"
              >
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1Large,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    ...shadows.medium,
  },
  inputContainer: {
    marginBottom: spacing.md,
  },
  input: {
    ...typography.body,
    color: colors.text.primary,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  passwordActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  rememberMeContainer: {
    flex: 1,
  },
  forgotPasswordText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  checkboxContainer: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    margin: 0,
  },
  checkboxText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontWeight: 'normal',
  },
  buttonContainer: {
    marginBottom: spacing.lg,
  },
  loginButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  buttonTitle: {
    ...typography.button,
    color: colors.onPrimary,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  registerLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: spacing.sm,
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DB4437', // Google brand color - keeping as is
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  googleIcon: {
    marginRight: spacing.sm,
  },
  googleButtonText: {
    ...typography.button,
    color: colors.onPrimary,
  },
});

export default LoginScreen;
