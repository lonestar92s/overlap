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
import { useAuth } from '../contexts/AuthContext';

const RegisterScreen = ({ navigation }) => {
  const { register, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedTier, setSelectedTier] = useState('freemium');
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
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      const result = await register(email.trim().toLowerCase(), password, selectedTier);
      
      if (result.success) {
        Alert.alert('Success', `Account created successfully with ${selectedTier} plan! Welcome to Flight Match Finder!`);
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
            <MaterialIcons name="sports-soccer" size={80} color="#1976d2" />
            <Text style={styles.title}>Join the Community</Text>
            <Text style={styles.subtitle}>Create your account to start planning football trips</Text>
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
              leftIcon={<MaterialIcons name="email" size={20} color="#666" />}
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
              leftIcon={<MaterialIcons name="lock" size={20} color="#666" />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <MaterialIcons 
                    name={showPassword ? "visibility-off" : "visibility"} 
                    size={20} 
                    color="#666" 
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
              leftIcon={<MaterialIcons name="lock" size={20} color="#666" />}
              rightIcon={
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <MaterialIcons 
                    name={showConfirmPassword ? "visibility-off" : "visibility"} 
                    size={20} 
                    color="#666" 
                  />
                </TouchableOpacity>
              }
              errorMessage={errors.confirmPassword}
              containerStyle={styles.inputContainer}
              inputStyle={styles.input}
              labelStyle={styles.label}
            />

            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              <Text style={[styles.requirement, password.length >= 8 && styles.requirementMet]}>
                • At least 8 characters
              </Text>
            </View>

            {/* Tier Selection */}
            <View style={styles.tierSection}>
              <Text style={styles.tierTitle}>Choose Your Plan</Text>
              <View style={styles.tierOptions}>
                <TouchableOpacity
                  style={[styles.tierOption, selectedTier === 'freemium' && styles.tierOptionSelected]}
                  onPress={() => setSelectedTier('freemium')}
                >
                  <View style={styles.tierHeader}>
                    <Text style={[styles.tierName, selectedTier === 'freemium' && styles.tierNameSelected]}>
                      Free
                    </Text>
                    <View style={[styles.tierBadge, styles.freeBadge]}>
                      <Text style={styles.tierBadgeText}>FREE</Text>
                    </View>
                  </View>
                  <Text style={styles.tierDescription}>
                    Premier League + international only
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tierOption, selectedTier === 'pro' && styles.tierOptionSelected]}
                  onPress={() => setSelectedTier('pro')}
                >
                  <View style={styles.tierHeader}>
                    <Text style={[styles.tierName, selectedTier === 'pro' && styles.tierNameSelected]}>
                      Pro
                    </Text>
                    <View style={[styles.tierBadge, styles.proBadge]}>
                      <Text style={styles.tierBadgeText}>PRO</Text>
                    </View>
                  </View>
                  <Text style={styles.tierDescription}>
                    Access to leagues around the world
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tierOption, selectedTier === 'planner' && styles.tierOptionSelected]}
                  onPress={() => setSelectedTier('planner')}
                >
                  <View style={styles.tierHeader}>
                    <Text style={[styles.tierName, selectedTier === 'planner' && styles.tierNameSelected]}>
                      Planner
                    </Text>
                    <View style={[styles.tierBadge, styles.plannerBadge]}>
                      <Text style={styles.tierBadgeText}>PLANNER</Text>
                    </View>
                  </View>
                  <Text style={styles.tierDescription}>
                    Access to all leagues and premium features
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              buttonStyle={styles.registerButton}
              titleStyle={styles.buttonTitle}
              containerStyle={styles.buttonContainer}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={navigateToLogin}>
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
  passwordRequirements: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  requirement: {
    fontSize: 12,
    color: '#999',
  },
  requirementMet: {
    color: '#4caf50',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  registerButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    paddingVertical: 12,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  // Tier Selection Styles
  tierSection: {
    marginBottom: 20,
  },
  tierTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  tierOptions: {
    gap: 12,
  },
  tierOption: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
  },
  tierOptionSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#f3f8ff',
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tierName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  tierNameSelected: {
    color: '#1976d2',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  freeBadge: {
    backgroundColor: '#4CAF50',
  },
  proBadge: {
    backgroundColor: '#FF9800',
  },
  plannerBadge: {
    backgroundColor: '#9C27B0',
  },
  tierBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tierDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default RegisterScreen;
