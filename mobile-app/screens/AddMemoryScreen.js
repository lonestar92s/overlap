import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Card, Input } from 'react-native-elements';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/api';

const AddMemoryScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState([]);
  
  // Form state
  const [homeTeam, setHomeTeam] = useState({ name: '', logo: null });
  const [awayTeam, setAwayTeam] = useState({ name: '', logo: null });
  const [venue, setVenue] = useState({ name: '', city: '', country: '' });
  const [competition, setCompetition] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [userScore, setUserScore] = useState('');
  const [userNotes, setUserNotes] = useState('');

  // Photo picker
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      // Create memory data with fallbacks for empty fields
      const memoryData = {
        homeTeam: homeTeam.name.trim() ? homeTeam : { name: 'Unknown Team' },
        awayTeam: awayTeam.name.trim() ? awayTeam : { name: 'Unknown Team' },
        venue: venue.name.trim() ? venue : { name: 'Unknown Venue', city: 'Unknown City', country: 'Unknown Country' },
        competition: competition.trim() || 'Unknown Competition',
        date: date || new Date().toISOString().split('T')[0],
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
  }, [validateForm, homeTeam, awayTeam, venue, competition, date, userScore, userNotes, photos, navigation]);

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
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Add Memory</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Photo Section */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>
            Add photos from your match experience
          </Text>
          
          <View style={styles.photoButtons}>
            <Button
              title="Take Photo"
              icon={
                <MaterialIcons name="camera-alt" size={20} color="white" style={{ marginRight: 8 }} />
              }
              onPress={takePhoto}
              buttonStyle={styles.photoButton}
              titleStyle={styles.photoButtonTitle}
            />
            
            <Button
              title="Choose Photos"
              icon={
                <MaterialIcons name="photo-library" size={20} color="white" style={{ marginRight: 8 }} />
              }
              onPress={pickImage}
              buttonStyle={styles.photoButton}
              titleStyle={styles.photoButtonTitle}
            />
          </View>

          {renderPhotoGrid()}
        </Card>

        {/* Match Details */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Match Details (Optional)</Text>
          
          <Input
            label="Home Team (Optional)"
            value={homeTeam.name}
            onChangeText={(text) => setHomeTeam(prev => ({ ...prev, name: text }))}
            placeholder="e.g., Liverpool"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Away Team (Optional)"
            value={awayTeam.name}
            onChangeText={(text) => setAwayTeam(prev => ({ ...prev, name: text }))}
            placeholder="e.g., Manchester United"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Competition/League (Optional)"
            value={competition}
            onChangeText={setCompetition}
            placeholder="e.g., Premier League"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Date (Optional)"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Score (Optional)"
            value={userScore}
            onChangeText={setUserScore}
            placeholder="e.g., 2-1"
            containerStyle={styles.inputContainer}
          />
        </Card>

        {/* Venue Details */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Venue (Optional)</Text>
          
          <Input
            label="Stadium Name (Optional)"
            value={venue.name}
            onChangeText={(text) => setVenue(prev => ({ ...prev, name: text }))}
            placeholder="e.g., Anfield"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="City (Optional)"
            value={venue.city}
            onChangeText={(text) => setVenue(prev => ({ ...prev, city: text }))}
            placeholder="e.g., Liverpool"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Country (Optional)"
            value={venue.country}
            onChangeText={(text) => setVenue(prev => ({ ...prev, country: text }))}
            placeholder="e.g., England"
            containerStyle={styles.inputContainer}
          />
        </Card>

        {/* Notes */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={userNotes}
            onChangeText={setUserNotes}
            placeholder="Share your match experience, memories, or any special moments..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </Card>

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            title={loading ? 'Creating Memory...' : 'Create Memory (Photos Only)'}
            onPress={handleSubmit}
            disabled={loading}
            buttonStyle={styles.submitButton}
            titleStyle={styles.submitButtonTitle}
            icon={
              loading ? (
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
              ) : (
                <MaterialIcons name="check" size="20" color="white" style={{ marginRight: 8 }} />
              )
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  placeholder: {
    width: 40,
  },
  card: {
    borderRadius: 16,
    margin: 20,
    marginTop: 0,
    padding: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    flex: 1,
  },
  photoButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  photoGrid: {
    marginTop: 16,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    backgroundColor: 'white',
  },
  submitContainer: {
    padding: 20,
    paddingTop: 0,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
  },
  submitButtonTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});

export default AddMemoryScreen;
