import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows, input, components } from '../styles/designTokens';
import { formatDateToLocalString, getTodayLocalString, createDateRange } from '../utils/dateUtils';

const AddMemoryScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  
  // Form state
  const [homeTeam, setHomeTeam] = useState({ name: '', logo: null });
  const [awayTeam, setAwayTeam] = useState({ name: '', logo: null });
  const [venue, setVenue] = useState({ name: '', city: '', country: '' });
  const [competition, setCompetition] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [selectedDates, setSelectedDates] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userScore, setUserScore] = useState('');
  const [userNotes, setUserNotes] = useState('');

  // Initialize selected dates when dateFrom/dateTo change
  useEffect(() => {
    if (dateFrom && dateTo) {
      const dateRange = createDateRange(dateFrom, dateTo);
      const dates = {};
      dateRange.forEach((dateStr, index) => {
        dates[dateStr] = {
          selected: true,
          startingDay: index === 0,
          endingDay: index === dateRange.length - 1,
          color: index === 0 || index === dateRange.length - 1 ? '#1976d2' : '#e3f2fd',
          textColor: index === 0 || index === dateRange.length - 1 ? 'white' : '#1976d2'
        };
      });
      setSelectedDates(dates);
    } else if (dateFrom) {
      setSelectedDates({
        [dateFrom]: {
          selected: true,
          startingDay: true,
          color: '#1976d2',
          textColor: 'white'
        }
      });
    } else {
      setSelectedDates({});
    }
  }, [dateFrom, dateTo]);

  // Format display date
  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    // Parse date string safely without timezone conversion
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle day press in calendar
  const onDayPress = (day) => {
    const dateString = day.dateString;
    
    if (!dateFrom || (dateFrom && dateTo)) {
      // Starting new selection
      setDateFrom(dateString);
      setDateTo(null);
      setSelectedDates({
        [dateString]: {
          selected: true,
          startingDay: true,
          color: '#1976d2',
          textColor: 'white'
        }
      });
    } else if (dateFrom && !dateTo) {
      // Selecting end date
      if (dateString < dateFrom) {
        // If selected date is before start date, make it the new start date
        setDateFrom(dateString);
        setDateTo(null);
        setSelectedDates({
          [dateString]: {
            selected: true,
            startingDay: true,
            color: '#1976d2',
            textColor: 'white'
          }
        });
      } else {
        // Valid end date selection
        setDateTo(dateString);
        
        // Create range marking
        const dateRange = createDateRange(dateFrom, dateString);
        const range = {};
        dateRange.forEach((dateStr, index) => {
          range[dateStr] = {
            selected: true,
            startingDay: index === 0,
            endingDay: index === dateRange.length - 1,
            color: index === 0 || index === dateRange.length - 1 ? '#1976d2' : '#e3f2fd',
            textColor: index === 0 || index === dateRange.length - 1 ? 'white' : '#1976d2'
          };
        });
        
        setSelectedDates(range);
        // Auto-close calendar after selecting date range
        setTimeout(() => setShowDatePicker(false), 500);
      }
    }
  };

  // Clear dates
  const clearDates = () => {
    setDateFrom(null);
    setDateTo(null);
    setSelectedDates({});
  };

  // Photo picker
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: false,  // No forced editing
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map(asset => ({
          uri: asset.uri,
          type: 'image/jpeg',
          width: asset.width,
          height: asset.height,
        }));
        
        setPhotos(prev => [...prev, ...newPhotos]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  }, []);

  // Take photo
  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,  // No forced editing
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newPhoto = {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          width: result.assets[0].width,
          height: result.assets[0].height,
        };
        
        setPhotos(prev => [...prev, newPhoto]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, []);

  // Remove photo
  const removePhoto = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Validate form - now only requires at least one photo
  const validateForm = useCallback(() => {
    if (photos.length === 0) {
      Alert.alert('Error', 'At least one photo is required to create a memory');
      return false;
    }
    return true;
  }, [photos]);

  // Submit memory
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Convert date range to single date (use dateFrom or current date)
      const dateValue = dateFrom || formatDateToLocalString(new Date());

      // Create memory data with fallbacks for empty fields
      const memoryData = {
        homeTeam: homeTeam.name.trim() ? homeTeam : { name: 'Unknown Team' },
        awayTeam: awayTeam.name.trim() ? awayTeam : { name: 'Unknown Team' },
        venue: venue.name.trim() ? venue : { name: 'Unknown Venue', city: 'Unknown City', country: 'Unknown Country' },
        competition: competition.trim() || 'Unknown Competition',
        date: dateValue,
        userScore: userScore.trim() || '',
        userNotes: userNotes.trim() || '',
      };

      const response = await ApiService.createMemory(memoryData, photos);
      
      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success!',
          'Memory created successfully',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error creating memory:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create memory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [validateForm, homeTeam, awayTeam, venue, competition, dateFrom, userScore, userNotes, photos, navigation]);

  // Render photo grid
  const renderPhotoGrid = useCallback(() => {
    if (photos.length === 0) return null;

    return (
      <View style={styles.photoGrid}>
        <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
        <View style={styles.photosContainer}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoItem}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => removePhoto(index)}
                accessibilityLabel="Remove photo"
                accessibilityRole="button"
              >
                <MaterialIcons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  }, [photos, removePhoto]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              accessibilityLabel="Go back"
              accessibilityRole="button"
            >
              <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>Add Memory</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Photo Section */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photos</Text>
            <Text style={styles.sectionSubtitle}>
              Add photos from your match experience
            </Text>
            
            <View style={styles.photoButtons}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={takePhoto}
                accessibilityLabel="Take photo"
                accessibilityRole="button"
              >
                <MaterialIcons name="camera-alt" size={20} color={colors.onPrimary} style={styles.photoButtonIcon} />
                <Text style={styles.photoButtonTitle}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.photoButton}
                onPress={pickImage}
                accessibilityLabel="Choose photos"
                accessibilityRole="button"
              >
                <MaterialIcons name="photo-library" size={20} color={colors.onPrimary} style={styles.photoButtonIcon} />
                <Text style={styles.photoButtonTitle}>Choose Photos</Text>
              </TouchableOpacity>
            </View>

            {renderPhotoGrid()}
          </View>

          {/* Match Details */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Match Details (Optional)</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Home Team (Optional)</Text>
              <TextInput
                style={styles.input}
                value={homeTeam.name}
                onChangeText={(text) => setHomeTeam(prev => ({ ...prev, name: text }))}
                placeholder="e.g., Liverpool"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="Home team name"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Away Team (Optional)</Text>
              <TextInput
                style={styles.input}
                value={awayTeam.name}
                onChangeText={(text) => setAwayTeam(prev => ({ ...prev, name: text }))}
                placeholder="e.g., Manchester United"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="Away team name"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Competition/League (Optional)</Text>
              <TextInput
                style={styles.input}
                value={competition}
                onChangeText={setCompetition}
                placeholder="e.g., Premier League"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="Competition or league name"
              />
            </View>
            
            {/* Date Range */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Date (Optional)</Text>
              <TouchableOpacity
                style={styles.dateRangeButton}
                onPress={() => setShowDatePicker(!showDatePicker)}
                activeOpacity={0.7}
                accessibilityLabel={dateFrom && dateTo 
                  ? `Selected dates: ${formatDisplayDate(dateFrom)} to ${formatDisplayDate(dateTo)}`
                  : 'Select date'}
                accessibilityRole="button"
              >
                <View style={styles.dateRangeContent}>
                  <View style={styles.dateSection}>
                    <Text style={styles.dateLabel}>From</Text>
                    <Text style={styles.dateValue}>{formatDisplayDate(dateFrom)}</Text>
                  </View>
                  <View style={styles.dateDivider} />
                  <View style={styles.dateSection}>
                    <Text style={styles.dateLabel}>To</Text>
                    <Text style={styles.dateValue}>{formatDisplayDate(dateTo)}</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {dateFrom && dateTo && (
                <TouchableOpacity style={styles.clearDatesButton} onPress={clearDates}>
                  <Text style={styles.clearDatesText}>Clear dates</Text>
                </TouchableOpacity>
              )}

              {showDatePicker && (
                <View style={styles.calendarContainer}>
                  <Calendar
                    onDayPress={onDayPress}
                    markingType={'period'}
                    markedDates={selectedDates}
                    minDate={getTodayLocalString()}
                    theme={{
                      selectedDayBackgroundColor: '#1976d2',
                      selectedDayTextColor: 'white',
                      todayTextColor: '#1976d2',
                      dayTextColor: '#333',
                      textDisabledColor: '#ccc',
                      arrowColor: '#1976d2',
                      monthTextColor: '#333',
                      textDayFontWeight: '500',
                      textMonthFontWeight: 'bold',
                      textDayHeaderFontWeight: '600',
                    }}
                  />
                </View>
              )}
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Score (Optional)</Text>
              <TextInput
                style={styles.input}
                value={userScore}
                onChangeText={setUserScore}
                placeholder="e.g., 2-1"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="Match score"
              />
            </View>
          </View>

          {/* Venue Details */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Venue (Optional)</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Stadium Name (Optional)</Text>
              <TextInput
                style={styles.input}
                value={venue.name}
                onChangeText={(text) => setVenue(prev => ({ ...prev, name: text }))}
                placeholder="e.g., Anfield"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="Stadium name"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>City (Optional)</Text>
              <TextInput
                style={styles.input}
                value={venue.city}
                onChangeText={(text) => setVenue(prev => ({ ...prev, city: text }))}
                placeholder="e.g., Liverpool"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="City name"
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Country (Optional)</Text>
              <TextInput
                style={styles.input}
                value={venue.country}
                onChangeText={(text) => setVenue(prev => ({ ...prev, country: text }))}
                placeholder="e.g., England"
                placeholderTextColor={colors.text.light}
                accessibilityLabel="Country name"
              />
            </View>
          </View>

          {/* Notes */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={userNotes}
              onChangeText={setUserNotes}
              placeholder="Share your match experience, memories, or any special moments..."
              placeholderTextColor={colors.text.light}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="Notes"
              accessibilityHint="Optional field to add notes about this memory"
            />
          </View>

          {/* Submit Button */}
          <View style={styles.submitContainer}>
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              accessibilityLabel={loading ? 'Creating memory' : 'Create memory'}
              accessibilityRole="button"
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.onPrimary} style={styles.submitButtonIcon} />
              ) : (
                <MaterialIcons name="check" size={20} color={colors.onPrimary} style={styles.submitButtonIcon} />
              )}
              <Text style={styles.submitButtonTitle}>
                {loading ? 'Creating Memory...' : 'Create Memory (Photos Only)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Spacer for keyboard */}
          <View style={styles.keyboardSpacer} />
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
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  title: {
    ...typography.h1,
    fontWeight: '700',
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  card: {
    ...components.card,
    marginHorizontal: spacing.lg,
    marginTop: 0,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: spacing.sm + spacing.xs,
    marginBottom: spacing.md,
  },
  photoButton: {
    ...components.button,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + spacing.xs,
  },
  photoButtonIcon: {
    marginRight: spacing.sm,
  },
  photoButtonTitle: {
    ...typography.button,
    color: colors.onPrimary,
  },
  photoGrid: {
    marginTop: spacing.md,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -spacing.sm,
    right: -spacing.sm,
    backgroundColor: colors.error,
    borderRadius: borderRadius.sm + spacing.xs,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm + spacing.xs,
  },
  input: {
    ...input,
  },
  dateRangeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.cardGrey,
    padding: spacing.md,
  },
  dateRangeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSection: {
    flex: 1,
  },
  dateLabel: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
  },
  dateValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  dateDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  clearDatesButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  clearDatesText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  calendarContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    ...shadows.small,
  },
  notesInput: {
    ...input,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: colors.cardGrey,
  },
  submitContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: 0,
    paddingBottom: spacing.lg,
  },
  submitButton: {
    ...components.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  submitButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
  },
  submitButtonIcon: {
    marginRight: spacing.sm,
  },
  submitButtonTitle: {
    ...typography.button,
    color: colors.onPrimary,
    fontWeight: '600',
  },
  keyboardSpacer: {
    minHeight: 200,
  },
});

export default AddMemoryScreen;
