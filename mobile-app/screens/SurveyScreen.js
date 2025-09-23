import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../services/api';

const SurveyScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // Survey responses state
  const [responses, setResponses] = useState({
    overallSatisfaction: null,
    primaryUseCase: null,
    favoriteFeatures: [],
    improvements: '',
    recommendationLikelihood: null,
    additionalComments: '',
    demographics: {
      ageRange: null,
      travelFrequency: null,
      footballFandom: null,
    }
  });

  const handleResponse = (field, value, isMultiple = false) => {
    if (isMultiple) {
      setResponses(prev => ({
        ...prev,
        [field]: prev[field].includes(value)
          ? prev[field].filter(item => item !== value)
          : [...prev[field], value]
      }));
    } else if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setResponses(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setResponses(prev => ({ ...prev, [field]: value }));
    }
  };

  const submitSurvey = async () => {
    setLoading(true);
    try {
      const surveyData = {
        ...responses,
        userId: user?.id,
        userEmail: user?.email,
        timestamp: new Date().toISOString(),
        appVersion: '1.0.0', // You can get this from app.json or package.json
      };

      await ApiService.submitSurvey(surveyData);
      
      Alert.alert(
        'Thank You! 🎉',
        'Your feedback has been submitted successfully. We really appreciate you taking the time to help us improve!',
        [
          {
            text: 'Continue',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Survey submission error:', error);
      Alert.alert(
        'Submission Error',
        'There was an issue submitting your feedback. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.stepDot,
            index + 1 <= currentStep ? styles.stepDotActive : styles.stepDotInactive
          ]}
        />
      ))}
      <Text style={styles.stepText}>Step {currentStep} of {totalSteps}</Text>
    </View>
  );

  const renderRatingScale = (field, question, scale = 5) => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionText}>{question}</Text>
      <View style={styles.ratingContainer}>
        {Array.from({ length: scale }).map((_, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.ratingButton,
              responses[field] === index + 1 && styles.ratingButtonSelected
            ]}
            onPress={() => handleResponse(field, index + 1)}
          >
            <Text style={[
              styles.ratingText,
              responses[field] === index + 1 && styles.ratingTextSelected
            ]}>
              {index + 1}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.ratingLabels}>
        <Text style={styles.ratingLabel}>Poor</Text>
        <Text style={styles.ratingLabel}>Excellent</Text>
      </View>
    </View>
  );

  const renderMultipleChoice = (field, question, options, isMultiple = false) => (
    <View style={styles.questionContainer}>
      <Text style={styles.questionText}>{question}</Text>
      {options.map((option, index) => (
        <TouchableOpacity
          key={index}
          style={styles.optionButton}
          onPress={() => handleResponse(field, option.value, isMultiple)}
        >
          <View style={styles.optionRow}>
            <View style={[
              styles.checkbox,
              (isMultiple 
                ? responses[field].includes(option.value)
                : responses[field] === option.value
              ) && styles.checkboxSelected
            ]}>
              {(isMultiple 
                ? responses[field].includes(option.value)
                : responses[field] === option.value
              ) && (
                <Icon name="check" size={16} color="#fff" />
              )}
            </View>
            <Text style={styles.optionText}>{option.label}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Overall Experience</Text>
      {renderRatingScale(
        'overallSatisfaction',
        'How satisfied are you with the Flight Match Finder app overall?'
      )}
      
      {renderMultipleChoice(
        'primaryUseCase',
        'What do you primarily use the app for?',
        [
          { value: 'finding_matches', label: 'Finding football matches to attend' },
          { value: 'planning_trips', label: 'Planning football-related trips' },
          { value: 'discovering_venues', label: 'Discovering new stadiums and venues' },
          { value: 'tracking_memories', label: 'Tracking football memories' },
          { value: 'other', label: 'Other' },
        ]
      )}
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Features & Functionality</Text>
      {renderMultipleChoice(
        'favoriteFeatures',
        'Which features do you find most valuable? (Select all that apply)',
        [
          { value: 'match_search', label: 'Match search and filtering' },
          { value: 'map_view', label: 'Map view of matches' },
          { value: 'trip_planning', label: 'Trip planning tools' },
          { value: 'memories', label: 'Memories and photo sharing' },
          { value: 'international_competitions', label: 'International competitions' },
          { value: 'venue_information', label: 'Stadium and venue information' },
          { value: 'notifications', label: 'Match notifications' },
        ],
        true
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Improvements & Recommendations</Text>
      
      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>
          What improvements would you like to see in the app?
        </Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={4}
          placeholder="Tell us what features or improvements you'd like to see..."
          value={responses.improvements}
          onChangeText={(text) => handleResponse('improvements', text)}
          textAlignVertical="top"
        />
      </View>

      {renderRatingScale(
        'recommendationLikelihood',
        'How likely are you to recommend this app to other football fans?',
        10
      )}
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>About You (Optional)</Text>
      
      {renderMultipleChoice(
        'demographics.ageRange',
        'What\'s your age range?',
        [
          { value: '18-24', label: '18-24' },
          { value: '25-34', label: '25-34' },
          { value: '35-44', label: '35-44' },
          { value: '45-54', label: '45-54' },
          { value: '55+', label: '55+' },
          { value: 'prefer_not_to_say', label: 'Prefer not to say' },
        ]
      )}

      {renderMultipleChoice(
        'demographics.travelFrequency',
        'How often do you travel to watch football?',
        [
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'few_times_year', label: 'A few times a year' },
          { value: 'annually', label: 'Once a year' },
          { value: 'rarely', label: 'Rarely' },
        ]
      )}

      {renderMultipleChoice(
        'demographics.footballFandom',
        'How would you describe your football fandom?',
        [
          { value: 'die_hard_fan', label: 'Die-hard fan of a specific team' },
          { value: 'general_fan', label: 'General football enthusiast' },
          { value: 'casual_viewer', label: 'Casual viewer' },
          { value: 'travel_focused', label: 'More interested in travel than football' },
        ]
      )}

      <View style={styles.questionContainer}>
        <Text style={styles.questionText}>
          Any additional comments or suggestions?
        </Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={4}
          placeholder="Share any other thoughts or suggestions..."
          value={responses.additionalComments}
          onChangeText={(text) => handleResponse('additionalComments', text)}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return responses.overallSatisfaction && responses.primaryUseCase;
      case 2:
        return responses.favoriteFeatures.length > 0;
      case 3:
        return responses.recommendationLikelihood;
      case 4:
        return true; // Optional step
      default:
        return false;
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#1976d2" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share Your Feedback</Text>
      </View>

      {renderStepIndicator()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentStep()}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.navigationButtons}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setCurrentStep(currentStep - 1)}
            >
              <Text style={styles.secondaryButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          
          {currentStep < totalSteps ? (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                !canProceed() && styles.primaryButtonDisabled
              ]}
              onPress={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              <Text style={styles.primaryButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={submitSurvey}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Submit Feedback</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  stepDotActive: {
    backgroundColor: '#1976d2',
  },
  stepDotInactive: {
    backgroundColor: '#e0e0e0',
  },
  stepText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  questionContainer: {
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  ratingButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  ratingButtonSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  ratingTextSelected: {
    color: '#fff',
  },
  ratingLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#999',
  },
  optionButton: {
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#1976d2',
    borderColor: '#1976d2',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 100,
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#ccc',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SurveyScreen;

