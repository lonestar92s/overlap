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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Button, Card, Input } from 'react-native-elements';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import ApiService from '../services/api';

const EditMemoryScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { memory } = route.params;
  
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState(memory.photos || []);
  
  // Form state - initialize with existing memory data
  const [homeTeam, setHomeTeam] = useState({
    name: memory.homeTeam?.name || '',
    logo: memory.homeTeam?.logo || null
  });
  const [awayTeam, setAwayTeam] = useState({
    name: memory.awayTeam?.name || '',
    logo: memory.awayTeam?.logo || null
  });
  const [venue, setVenue] = useState({
    name: memory.venue?.name || '',
    city: memory.venue?.city || '',
    country: memory.venue?.country || ''
  });
  const [competition, setCompetition] = useState(memory.competition || '');
  const [date, setDate] = useState(memory.date ? new Date(memory.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  const [userScore, setUserScore] = useState(memory.userScore || '');
  const [userNotes, setUserNotes] = useState(memory.userNotes || '');

  // Photo picker
  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'Images',
        allowsEditing: false,
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
        allowsEditing: false,
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

  // Validate form
  const validateForm = useCallback(() => {
    if (photos.length === 0) {
      Alert.alert('Error', 'At least one photo is required');
      return false;
    }
    return true;
  }, [photos]);

  // Delete memory
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
                Alert.alert(
                  'Success!',
                  'Memory deleted successfully',
                  [
                    {
                      text: 'OK',
                      onPress: () => navigation.goBack()
                    }
                  ]
                );
              }
            } catch (error) {
              console.error('Error deleting memory:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete memory. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  }, [memory, navigation]);

  // Update memory
  const handleUpdate = useCallback(async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Create memory data
      const memoryData = {
        homeTeam: homeTeam.name.trim() ? homeTeam : { name: 'Unknown Team' },
        awayTeam: awayTeam.name.trim() ? awayTeam : { name: 'Unknown Team' },
        venue: venue.name.trim() ? venue : { name: 'Unknown Venue', city: 'Unknown City', country: 'Unknown Country' },
        competition: competition.trim() || 'Unknown Competition',
        date: date || new Date().toISOString().split('T')[0],
        userScore: userScore.trim() || '',
        userNotes: userNotes.trim() || '',
      };

      // Separate existing photos from new photos
      const existingPhotos = photos.filter(photo => photo.publicId); // Photos already uploaded
      const newPhotos = photos.filter(photo => !photo.publicId); // New photos to upload

      const response = await ApiService.updateMemory(memory._id || memory.matchId, memoryData, newPhotos);
      
      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Success!',
          'Memory updated successfully',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error updating memory:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update memory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [validateForm, homeTeam, awayTeam, venue, competition, date, userScore, userNotes, photos, memory, navigation]);

  // Render photo grid
  const renderPhotoGrid = useCallback(() => {
    if (photos.length === 0) return null;

    return (
      <View style={styles.photoGrid}>
        <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
        <View style={styles.photosContainer}>
          {photos.map((photo, index) => (
            <View key={index} style={styles.photoItem}>
              <Image 
                source={{ uri: photo.uri || photo.url }} 
                style={styles.photoThumbnail} 
              />
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
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Memory</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            disabled={loading}
            accessibilityLabel="Delete memory"
            accessibilityRole="button"
          >
            <MaterialIcons name="delete-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* Photo Section */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>
            Add or remove photos from your match experience
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
          <Text style={styles.sectionTitle}>Match Details</Text>
          
          <Input
            label="Home Team"
            value={homeTeam.name}
            onChangeText={(text) => setHomeTeam(prev => ({ ...prev, name: text }))}
            placeholder="e.g., Liverpool"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Away Team"
            value={awayTeam.name}
            onChangeText={(text) => setAwayTeam(prev => ({ ...prev, name: text }))}
            placeholder="e.g., Manchester United"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Competition/League"
            value={competition}
            onChangeText={setCompetition}
            placeholder="e.g., Premier League"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Date"
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Score"
            value={userScore}
            onChangeText={setUserScore}
            placeholder="e.g., 2-1"
            containerStyle={styles.inputContainer}
          />
        </Card>

        {/* Venue Details */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Venue</Text>
          
          <Input
            label="Stadium Name"
            value={venue.name}
            onChangeText={(text) => setVenue(prev => ({ ...prev, name: text }))}
            placeholder="e.g., Anfield"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="City"
            value={venue.city}
            onChangeText={(text) => setVenue(prev => ({ ...prev, city: text }))}
            placeholder="e.g., Liverpool"
            containerStyle={styles.inputContainer}
          />
          
          <Input
            label="Country"
            value={venue.country}
            onChangeText={(text) => setVenue(prev => ({ ...prev, country: text }))}
            placeholder="e.g., England"
            containerStyle={styles.inputContainer}
          />
        </Card>

        {/* Notes */}
        <Card containerStyle={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
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

        {/* Update Button */}
        <View style={styles.submitContainer}>
          <Button
            title={loading ? 'Updating Memory...' : 'Update Memory'}
            onPress={handleUpdate}
            disabled={loading}
            buttonStyle={styles.submitButton}
            titleStyle={styles.submitButtonTitle}
            icon={
              loading ? (
                <ActivityIndicator size="small" color="white" style={{ marginRight: 8 }} />
              ) : (
                <MaterialIcons name="save" size="20" color="white" style={{ marginRight: 8 }} />
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
  deleteButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
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

export default EditMemoryScreen;
