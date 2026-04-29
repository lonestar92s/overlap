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
  SafeAreaView,
  Linking,
  Image
} from 'react-native';
import { Input, Button } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';
import { getLegalPageUrls } from '../config/legalUrls';

const RegisterScreen = ({ navigation }) => {
  const { register, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState({});

  const openLegalDoc = async (which) => {
    const { termsUrl, privacyUrl } = getLegalPageUrls();
    const url = which === 'terms' ? termsUrl : privacyUrl;
    if (!url) {
      Alert.alert(
        'Legal',
        'Set EXPO_PUBLIC_WEB_APP_URL to your deployed web app (no trailing slash) so Terms and Privacy open in the browser. In development, localhost:3000 is used if unset.'
      );
      return;
    }
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to open', url);
      }
    } catch {
      Alert.alert('Error', 'Could not open the link.');
    }
  };

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
    } else {
      // Check password complexity requirements
      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      
      if (!hasUppercase || !hasLowercase || !hasNumber) {
        newErrors.password = 'Password must contain uppercase, lowercase, and a number';
      }
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptedTerms) {
      newErrors.terms = 'You must accept the Terms of Service and Privacy Policy';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      const result = await register(email.trim().toLowerCase(), password, acceptedTerms);
      
      if (result.success) {
        Alert.alert('Success', 'Account created successfully! Welcome to Flight Match Finder!');
        // Navigation will be handled by App.js based on auth state
      } else {
        Alert.alert('Registration Failed', result.error || 'Please try again');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Image
              source={require('../assets/overlap_logo_variant_3.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Overlap logo"
            />
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
            />

            <Input
              label="Password"
              placeholder="Create a password"
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
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              leftIcon={<MaterialIcons name="lock" size={20} color={colors.text.secondary} />}
              rightIcon={
                <TouchableOpacity 
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  accessibilityLabel={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  accessibilityRole="button"
                >
                  <MaterialIcons 
                    name={showConfirmPassword ? "visibility-off" : "visibility"} 
                    size={20} 
                    color={colors.text.secondary} 
                  />
                </TouchableOpacity>
              }
              errorMessage={errors.confirmPassword}
              containerStyle={styles.inputContainer}
              inputStyle={styles.input}
              labelStyle={styles.label}
            />

            <View style={styles.legalRow}>
              <TouchableOpacity
                onPress={() => setAcceptedTerms(!acceptedTerms)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
                accessibilityLabel="Toggle accept Terms of Service and Privacy Policy"
              >
                <MaterialIcons
                  name={acceptedTerms ? 'check-box' : 'check-box-outline-blank'}
                  size={24}
                  color={acceptedTerms ? colors.primary : colors.text.secondary}
                  style={styles.legalCheckIcon}
                />
              </TouchableOpacity>
              <Text style={styles.legalText}>
                <Text onPress={() => setAcceptedTerms(!acceptedTerms)}>I agree to the </Text>
                <Text style={styles.legalLink} onPress={() => openLegalDoc('terms')}>
                  Terms of Service
                </Text>
                <Text onPress={() => setAcceptedTerms(!acceptedTerms)}> and </Text>
                <Text style={styles.legalLink} onPress={() => openLegalDoc('privacy')}>
                  Privacy Policy
                </Text>
                <Text onPress={() => setAcceptedTerms(!acceptedTerms)}>.</Text>
              </Text>
            </View>
            {errors.terms ? (
              <Text style={styles.termsError}>{errors.terms}</Text>
            ) : null}

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <Text style={[styles.requirement, password.length >= 8 && styles.requirementMet]}>
                • At least 8 characters
              </Text>
              <Text style={[styles.requirement, /[A-Z]/.test(password) && styles.requirementMet]}>
                • One uppercase letter
              </Text>
              <Text style={[styles.requirement, /[a-z]/.test(password) && styles.requirementMet]}>
                • One lowercase letter
              </Text>
              <Text style={[styles.requirement, /[0-9]/.test(password) && styles.requirementMet]}>
                • One number
              </Text>
            </View>

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              disabled={loading || !acceptedTerms}
              buttonStyle={styles.registerButton}
              titleStyle={styles.buttonTitle}
              containerStyle={styles.buttonContainer}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity 
                onPress={navigateToLogin}
                accessibilityLabel="Sign in"
                accessibilityRole="link"
              >
                <Text style={styles.loginLink}>Sign In</Text>
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
    backgroundColor: colors.card,
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
    marginBottom: spacing.lg,
  },
  logo: {
    width: 260,
    height: 60,
    marginBottom: 0,
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
  passwordRequirements: {
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.cardGrey,
    borderRadius: borderRadius.sm,
  },
  requirementsTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  requirement: {
    ...typography.bodySmall,
    color: colors.text.light,
    marginBottom: spacing.xs,
  },
  requirementMet: {
    color: colors.success,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  legalCheckIcon: {
    marginTop: 2,
    marginRight: spacing.sm,
  },
  legalText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    flex: 1,
    flexWrap: 'wrap',
  },
  legalLink: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  termsError: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  buttonContainer: {
    marginBottom: spacing.lg,
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  buttonTitle: {
    ...typography.button,
    color: colors.onPrimary,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  loginLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default RegisterScreen;
