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
import { Input, Button } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import ApiService from '../services/api';
import { colors, spacing, typography } from '../styles/designTokens';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleForgotPassword = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const response = await ApiService.requestPasswordReset(email.trim().toLowerCase());
      
      if (response.success || response.message) {
        setEmailSent(true);
        
        // Show reset token in development mode
        if (response.resetToken && __DEV__) {
          Alert.alert(
            'Password Reset (Development Mode)',
            `Reset token: ${response.resetToken}\n\nReset URL: ${response.resetUrl}\n\nThis is only shown in development mode.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Check Your Email',
            response.message || 'If an account with that email exists, a password reset link has been sent.',
            [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
          );
        }
      } else {
        Alert.alert('Error', response.error || 'Failed to send password reset email');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
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
          {/* Header with back button */}
          <View style={styles.topHeader}>
            <TouchableOpacity
              style={styles.headerBackButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.header}>
            <MaterialIcons name="lock-reset" size={80} color="#1976d2" />
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              {emailSent 
                ? 'Check your email for password reset instructions'
                : "Enter your email address and we'll send you a link to reset your password"
              }
            </Text>
          </View>

          {!emailSent ? (
            <View style={styles.form}>
              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<MaterialIcons name="email" size={20} color="#666" />}
                errorMessage={errors.email}
                containerStyle={styles.inputContainer}
                inputStyle={styles.input}
                labelStyle={styles.label}
              />

              <Button
                title="Send Reset Link"
                onPress={handleForgotPassword}
                loading={loading}
                disabled={loading}
                buttonStyle={styles.resetButton}
                titleStyle={styles.buttonTitle}
                containerStyle={styles.buttonContainer}
              />

              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  Note: If you signed up with Gmail, please use Google's password reset process instead.
                </Text>
              </View>

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Remember your password? </Text>
                <TouchableOpacity onPress={navigateToLogin}>
                  <Text style={styles.loginLink}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.successContainer}>
                <MaterialIcons name="check-circle" size={60} color="#4caf50" />
                <Text style={styles.successText}>
                  Password reset instructions have been sent to your email address.
                </Text>
                <Text style={styles.successSubtext}>
                  Please check your inbox and follow the instructions to reset your password.
                </Text>
              </View>

              <Button
                title="Back to Login"
                onPress={navigateToLogin}
                buttonStyle={styles.backButton}
                titleStyle={styles.buttonTitle}
                containerStyle={styles.buttonContainer}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerBackButton: {
    padding: spacing.sm,
  },
  placeholder: {
    width: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    fontSize: 16,
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  buttonContainer: {
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
  },
  backButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  infoText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  successText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 10,
    fontWeight: '600',
  },
  successSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default ForgotPasswordScreen;

