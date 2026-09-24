import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import ApiService from '../services/api';
import EntitySearchField from '../components/EntitySearchField';
import { colors, spacing, typography, borderRadius, shadows, input, components } from '../styles/designTokens';
import { formatDateToLocalString, getTodayLocalString } from '../utils/dateUtils';

const toDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return formatDateToLocalString(new Date(value));
};

const EditMemoryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { memory } = route.params;

  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState(memory.photos || []);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const [homeTeam, setHomeTeam] = useState({
    name: memory.homeTeam?.name || '',
    logo: memory.homeTeam?.logo || null,
    apiId: memory.homeTeam?.apiId || null,
  });
  const [awayTeam, setAwayTeam] = useState({
    name: memory.awayTeam?.name || '',
    logo: memory.awayTeam?.logo || null,
    apiId: memory.awayTeam?.apiId || null,
  });
  const [venue, setVenue] = useState({
    name: memory.venue?.name || '',
    city: memory.venue?.city || '',
    country: memory.venue?.country || '',
    coordinates: memory.venue?.coordinates || null,
  });
  const [competition, setCompetition] = useState(memory.competition || '');
  const [venueSuggestion, setVenueSuggestion] = useState(null);
  const [matchDate, setMatchDate] = useState(toDateOnly(memory.date));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userScore, setUserScore] = useState(memory.userScore || '');
  const [userNotes, setUserNotes] = useState(memory.userNotes || '');

  const formatDisplayDate = (dateString) => {
    if (!dateString) return 'Select date';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const onDayPress = (day) => {
    setMatchDate(day.dateString);
    setShowDatePicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const clearDate = () => {
    setMatchDate(null);
    setShowDatePicker(false);
  };

  const getPhotoUri = (photo) => photo.uri || photo.url || null;

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
      });

      if (!result.canceled && result.assets) {
        const newPhotos = result.assets.map((asset) => ({
          uri: asset.uri,
          type: 'image/jpeg',
          width: asset.width,
          height: asset.height,
        }));

        setPhotos((prev) => [...prev, ...newPhotos]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  }, []);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        setPhotos((prev) => [
          ...prev,
          {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            width: result.assets[0].width,
            height: result.assets[0].height,
          },
        ]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  }, []);

  const removePhoto = useCallback((index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const validateForm = useCallback(() => {
    if (photos.length === 0) {
      Alert.alert('Add a photo', 'At least one photo is required to save this memory');
      return false;
    }
    return true;
  }, [photos]);

  const handleDelete = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Delete Memory',
      'Are you sure you want to delete this memory? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await ApiService.deleteMemory(memory._id || memory.matchId);

              if (response.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error deleting memory:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete memory. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }, [memory, navigation]);

  const handleUpdate = useCallback(async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const memoryData = {
        homeTeam: homeTeam.name.trim()
          ? {
              name: homeTeam.name.trim(),
              logo: homeTeam.logo || null,
              ...(homeTeam.apiId ? { apiId: String(homeTeam.apiId) } : {}),
            }
          : { name: 'Unknown Team' },
        awayTeam: awayTeam.name.trim()
          ? {
              name: awayTeam.name.trim(),
              logo: awayTeam.logo || null,
              ...(awayTeam.apiId ? { apiId: String(awayTeam.apiId) } : {}),
            }
          : { name: 'Unknown Team' },
        venue: venue.name.trim()
          ? {
              name: venue.name.trim(),
              city: venue.city.trim() || '',
              country: venue.country.trim() || '',
              ...(Array.isArray(venue.coordinates) && venue.coordinates.length === 2
                ? { coordinates: venue.coordinates }
                : {}),
            }
          : { name: 'Unknown Venue', city: 'Unknown City', country: 'Unknown Country' },
        competition: competition.trim() || 'Unknown Competition',
        date: matchDate || formatDateToLocalString(new Date()),
        userScore: userScore.trim() || '',
        userNotes: userNotes.trim() || '',
      };

      const newPhotos = photos.filter((photo) => !photo.publicId);

      const response = await ApiService.updateMemory(
        memory._id || memory.matchId,
        memoryData,
        newPhotos
      );

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Saved', 'Memory updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error updating memory:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update memory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    validateForm,
    homeTeam,
    awayTeam,
    venue,
    competition,
    matchDate,
    userScore,
    userNotes,
    photos,
    memory,
    navigation,
  ]);

  const markedDates = matchDate
    ? {
        [matchDate]: {
          selected: true,
          selectedColor: colors.primary,
          selectedTextColor: colors.onPrimary,
        },
      }
    : {};

  const detailsSummary = [
    homeTeam.name.trim() || awayTeam.name.trim()
      ? [homeTeam.name.trim(), awayTeam.name.trim()].filter(Boolean).join(' vs ')
      : null,
    matchDate ? formatDisplayDate(matchDate) : null,
    venue.name.trim() || null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Cancel"
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Memory</Text>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={loading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Delete memory"
            accessibilityRole="button"
            style={styles.deleteButton}
          >
            <MaterialIcons name="delete-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.photoSection}>
            {photos.length === 0 ? (
              <TouchableOpacity
                style={styles.photoDropzone}
                onPress={pickImage}
                activeOpacity={0.7}
                accessibilityLabel="Add photos"
                accessibilityRole="button"
              >
                <View style={styles.dropzoneIcon}>
                  <MaterialIcons name="add-a-photo" size={32} color={colors.primary} />
                </View>
                <Text style={styles.dropzoneTitle}>Add photos</Text>
                <Text style={styles.dropzoneSubtitle}>At least one photo is required</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.photosContainer}>
                {photos.map((photo, index) => {
                  const uri = getPhotoUri(photo);
                  return (
                    <View key={photo.publicId || uri || `photo-${index}`} style={styles.photoItem}>
                      {uri ? (
                        <Image source={{ uri }} style={styles.photoThumbnail} />
                      ) : (
                        <View style={[styles.photoThumbnail, styles.photoPlaceholder]}>
                          <MaterialIcons name="broken-image" size={28} color={colors.text.light} />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                        accessibilityLabel="Remove photo"
                        accessibilityRole="button"
                      >
                        <MaterialIcons name="close" size={16} color={colors.onPrimary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={styles.addMorePhoto}
                  onPress={pickImage}
                  accessibilityLabel="Add more photos"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="add" size={28} color={colors.text.secondary} />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={takePhoto}
                accessibilityLabel="Take photo"
                accessibilityRole="button"
              >
                <MaterialIcons name="camera-alt" size={18} color={colors.text.primary} />
                <Text style={styles.secondaryButtonText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={pickImage}
                accessibilityLabel="Choose photos"
                accessibilityRole="button"
              >
                <MaterialIcons name="photo-library" size={18} color={colors.text.primary} />
                <Text style={styles.secondaryButtonText}>Library</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.detailsCard}>
            <TouchableOpacity
              style={styles.detailsHeader}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDetailsExpanded((prev) => !prev);
              }}
              activeOpacity={0.7}
              accessibilityLabel={detailsExpanded ? 'Hide match details' : 'Edit match details'}
              accessibilityRole="button"
            >
              <View style={styles.detailsHeaderText}>
                <Text style={styles.detailsTitle}>Match details</Text>
                <Text style={styles.detailsSubtitle} numberOfLines={1}>
                  {detailsSummary || 'Teams, date, venue, notes'}
                </Text>
              </View>
              <MaterialIcons
                name={detailsExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color={colors.text.secondary}
              />
            </TouchableOpacity>

            {detailsExpanded && (
              <View style={styles.detailsBody}>
                <EntitySearchField
                  label="Home team"
                  value={homeTeam.name}
                  entityType="team"
                  placeholder="e.g., Liverpool"
                  selectedBadge={homeTeam.logo}
                  accessibilityLabel="Home team name"
                  onChangeText={(text) => {
                    setHomeTeam({ name: text, logo: null, apiId: null });
                    setVenueSuggestion(null);
                  }}
                  onSelect={(item) => {
                    setHomeTeam({
                      name: item.name,
                      logo: item.badge || null,
                      apiId: item.id != null ? String(item.id) : null,
                    });
                    if (item.relatedVenue?.name && !venue.name.trim()) {
                      setVenueSuggestion(item.relatedVenue);
                    } else {
                      setVenueSuggestion(null);
                    }
                  }}
                />

                <EntitySearchField
                  label="Away team"
                  value={awayTeam.name}
                  entityType="team"
                  placeholder="e.g., Manchester United"
                  selectedBadge={awayTeam.logo}
                  accessibilityLabel="Away team name"
                  onChangeText={(text) => setAwayTeam({ name: text, logo: null, apiId: null })}
                  onSelect={(item) => {
                    setAwayTeam({
                      name: item.name,
                      logo: item.badge || null,
                      apiId: item.id != null ? String(item.id) : null,
                    });
                  }}
                />

                <EntitySearchField
                  label="Competition"
                  value={competition}
                  entityType="league"
                  placeholder="e.g., Premier League"
                  accessibilityLabel="Competition or league name"
                  onChangeText={setCompetition}
                  onSelect={(item) => setCompetition(item.name)}
                />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Date</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => setShowDatePicker((prev) => !prev)}
                    activeOpacity={0.7}
                    accessibilityLabel={
                      matchDate ? `Selected date: ${formatDisplayDate(matchDate)}` : 'Select date'
                    }
                    accessibilityRole="button"
                  >
                    <MaterialIcons name="event" size={20} color={colors.text.secondary} />
                    <Text style={[styles.dateValue, !matchDate && styles.datePlaceholder]}>
                      {formatDisplayDate(matchDate)}
                    </Text>
                  </TouchableOpacity>

                  {matchDate && (
                    <TouchableOpacity style={styles.clearDateButton} onPress={clearDate}>
                      <Text style={styles.clearDateText}>Clear date</Text>
                    </TouchableOpacity>
                  )}

                  {showDatePicker && (
                    <View style={styles.calendarContainer}>
                      <Calendar
                        onDayPress={onDayPress}
                        markedDates={markedDates}
                        maxDate={getTodayLocalString()}
                        theme={{
                          selectedDayBackgroundColor: colors.primary,
                          selectedDayTextColor: colors.onPrimary,
                          todayTextColor: colors.primary,
                          dayTextColor: colors.text.primary,
                          textDisabledColor: colors.text.light,
                          arrowColor: colors.primary,
                          monthTextColor: colors.text.primary,
                          textDayFontWeight: '500',
                          textMonthFontWeight: 'bold',
                          textDayHeaderFontWeight: '600',
                        }}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Score</Text>
                  <TextInput
                    style={styles.input}
                    value={userScore}
                    onChangeText={setUserScore}
                    placeholder="e.g., 2-1"
                    placeholderTextColor={colors.text.light}
                    accessibilityLabel="Match score"
                  />
                </View>

                <EntitySearchField
                  label="Stadium"
                  value={venue.name}
                  entityType="venue"
                  placeholder="e.g., Anfield"
                  accessibilityLabel="Stadium name"
                  hint={
                    venue.city || venue.country
                      ? `Location: ${[venue.city, venue.country].filter(Boolean).join(', ')}`
                      : 'City and country fill in when you pick a stadium'
                  }
                  onChangeText={(text) => {
                    setVenue((prev) => ({
                      ...prev,
                      name: text,
                      coordinates: null,
                    }));
                    setVenueSuggestion(null);
                  }}
                  onSelect={(item) => {
                    setVenue({
                      name: item.name,
                      city: item.city || '',
                      country: item.country || '',
                      coordinates: Array.isArray(item.coordinates) ? item.coordinates : null,
                    });
                    setVenueSuggestion(null);
                  }}
                />

                {venueSuggestion?.name ? (
                  <TouchableOpacity
                    style={styles.suggestionBanner}
                    onPress={() => {
                      setVenue({
                        name: venueSuggestion.name,
                        city: venueSuggestion.city || '',
                        country: venueSuggestion.country || '',
                        coordinates: null,
                      });
                      setVenueSuggestion(null);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Use suggested stadium ${venueSuggestion.name}`}
                  >
                    <MaterialIcons name="stadium" size={18} color={colors.primary} />
                    <Text style={styles.suggestionText}>
                      Use {venueSuggestion.name}
                      {venueSuggestion.city ? ` (${venueSuggestion.city})` : ''}?
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <View style={styles.row}>
                  <View style={[styles.inputGroup, styles.flex]}>
                    <Text style={styles.label}>City</Text>
                    <TextInput
                      style={styles.input}
                      value={venue.city}
                      onChangeText={(text) => setVenue((prev) => ({ ...prev, city: text }))}
                      placeholder="Liverpool"
                      placeholderTextColor={colors.text.light}
                      accessibilityLabel="City name"
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.flex]}>
                    <Text style={styles.label}>Country</Text>
                    <TextInput
                      style={styles.input}
                      value={venue.country}
                      onChangeText={(text) => setVenue((prev) => ({ ...prev, country: text }))}
                      placeholder="England"
                      placeholderTextColor={colors.text.light}
                      accessibilityLabel="Country name"
                    />
                  </View>
                </View>

                <View style={[styles.inputGroup, styles.lastInputGroup]}>
                  <Text style={styles.label}>Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={userNotes}
                    onChangeText={setUserNotes}
                    placeholder="Anything memorable about the day…"
                    placeholderTextColor={colors.text.light}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    accessibilityLabel="Notes"
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (loading || photos.length === 0) && styles.saveButtonDisabled,
            ]}
            onPress={handleUpdate}
            disabled={loading || photos.length === 0}
            accessibilityLabel={loading ? 'Saving changes' : 'Save changes'}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  cancelText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '500',
    minWidth: 64,
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.text.primary,
  },
  deleteButton: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  photoSection: {
    marginBottom: spacing.lg,
  },
  photoDropzone: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  dropzoneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.status.attendedBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  dropzoneTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  dropzoneSubtitle: {
    ...typography.bodySmall,
    color: colors.text.secondary,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.sm,
  },
  photoPlaceholder: {
    backgroundColor: colors.cardGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePhoto: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryButton: {
    ...components.buttonSecondary,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + spacing.xs,
  },
  secondaryButtonText: {
    ...typography.button,
    color: colors.text.primary,
    fontSize: 15,
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    ...shadows.small,
    overflow: 'hidden',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  detailsHeaderText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  detailsTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  detailsSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  detailsBody: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
  },
  inputGroup: {
    marginTop: spacing.md,
  },
  lastInputGroup: {
    marginBottom: spacing.xs,
  },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.attendancePromptBg,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  suggestionText: {
    ...typography.bodySmall,
    color: colors.text.primary,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    ...input,
    backgroundColor: colors.cardGrey,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.cardGrey,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  dateValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '500',
  },
  datePlaceholder: {
    color: colors.text.light,
    fontWeight: '400',
  },
  clearDateButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  calendarContainer: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  notesInput: {
    ...input,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: colors.cardGrey,
    paddingTop: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  saveButton: {
    ...components.button,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  saveButtonDisabled: {
    backgroundColor: colors.interactive.disabled,
  },
  saveButtonText: {
    ...typography.button,
    color: colors.onPrimary,
    fontWeight: '600',
  },
});

export default EditMemoryScreen;
