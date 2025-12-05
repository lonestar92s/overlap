import React, { useState, useEffect } from 'react';
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
import { Input, Button } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';

const ResetPasswordScreen = ({ navigation, route }) => {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Get token from route params (for deep linking) or use state
  useEffect(() => {
    if (route?.params?.token) {
      setToken(route.params.token);
    }
  }, [route?.params?.token]);

  // Password validation helpers
  const validatePassword = (pwd) => {
    const requirements = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
    };
    return requirements;
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!token.trim()) {
      newErrors.token = 'Reset token is required';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else {
      const requirements = validatePassword(password);
      if (!requirements.length) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!requirements.uppercase || !requirements.lowercase || !requirements.number) {
        newErrors.password = 'Password must contain uppercase, lowercase, and a number';
      }
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const response = await ApiService.resetPassword(token.trim(), password);
      
      if (response.success) {
        Alert.alert(
          'Success',
          'Your password has been reset successfully. Please sign in with your new password.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Login')
            }
          ]
        );
      } else {
        Alert.alert('Reset Failed', response.error || 'Failed to reset password. The link may have expired.');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  const navigateToForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  const passwordRequirements = validatePassword(password);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <MaterialIcons name="lock-reset" size={80} color={colors.primary} />
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below
            </Text>
          </View>

          <View style={styles.form}>
            {!route?.params?.token && (
              <Input
                label="Reset Token"
                placeholder="Enter reset token from email"
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<MaterialIcons name="vpn-key" size={20} color={colors.text.secondary} />}
                errorMessage={errors.token}
                containerStyle={styles.inputContainer}
                inputStyle={styles.input}
                labelStyle={styles.label}
                accessibilityLabel="Reset token input"
                accessibilityHint="Enter the reset token you received in your email"
              />
            )}

            <Input
              label="New Password"
              placeholder="Enter your new password"
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
              accessibilityLabel="New password input"
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm your new password"
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
              accessibilityLabel="Confirm password input"
            />

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <Text style={[styles.requirement, passwordRequirements.length && styles.requirementMet]}>
                • At least 8 characters
              </Text>
              <Text style={[styles.requirement, passwordRequirements.uppercase && styles.requirementMet]}>
                • One uppercase letter
              </Text>
              <Text style={[styles.requirement, passwordRequirements.lowercase && styles.requirementMet]}>
                • One lowercase letter
              </Text>
              <Text style={[styles.requirement, passwordRequirements.number && styles.requirementMet]}>
                • One number
              </Text>
            </View>

            <Button
              title="Reset Password"
              onPress={handleResetPassword}
              loading={loading}
              disabled={loading}
              buttonStyle={styles.resetButton}
              titleStyle={styles.buttonTitle}
              containerStyle={styles.buttonContainer}
              accessibilityLabel="Reset password button"
              accessibilityRole="button"
            />

            <View style={styles.linkContainer}>
              <TouchableOpacity 
                onPress={navigateToLogin}
                accessibilityLabel="Back to login"
                accessibilityRole="link"
              >
                <Text style={styles.linkText}>Back to Login</Text>
              </TouchableOpacity>
              <Text style={styles.linkSeparator}>•</Text>
              <TouchableOpacity 
                onPress={navigateToForgotPassword}
                accessibilityLabel="Request new reset link"
                accessibilityRole="link"
              >
                <Text style={styles.linkText}>Request New Link</Text>
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
  buttonContainer: {
    marginBottom: spacing.lg,
  },
  resetButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.md,
  },
  buttonTitle: {
    ...typography.button,
    color: colors.onPrimary,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  linkSeparator: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginHorizontal: spacing.sm,
  },
});

export default ResetPasswordScreen;

