import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { Avatar, Card } from 'react-native-elements';

const { height: screenHeight } = Dimensions.get('window');

const MatchModal = ({ visible, match, onClose }) => {
  const slideAnim = React.useRef(new Animated.Value(screenHeight)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: screenHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!match) return null;

  const venue = match.fixture?.venue;
  const matchDate = new Date(match.fixture.date);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              style={[
                styles.modalContainer,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleBar} />
              
              {/* Close button */}
              <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>

              {/* Match content */}
              <View style={styles.content}>
                {/* Date and time */}
                <View style={styles.dateTimeSection}>
                  <Text style={styles.dateText}>
                    {matchDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Text>
                  <Text style={styles.timeText}>
                    {matchDate.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </Text>
                </View>

                {/* Teams */}
                <View style={styles.teamsSection}>
                  <View style={styles.teamContainer}>
                    <Avatar
                      source={{ uri: match.teams.home.logo }}
                      size={70}
                      containerStyle={styles.teamLogo}
                    />
                    <Text style={styles.teamName}>{match.teams.home.name}</Text>
                  </View>

                  <View style={styles.vsContainer}>
                    <Text style={styles.vsText}>VS</Text>
                  </View>

                  <View style={styles.teamContainer}>
                    <Avatar
                      source={{ uri: match.teams.away.logo }}
                      size={70}
                      containerStyle={styles.teamLogo}
                    />
                    <Text style={styles.teamName}>{match.teams.away.name}</Text>
                  </View>
                </View>

                {/* Venue Info */}
                {venue && (
                  <View style={styles.venueSection}>
                    <Text style={styles.venueTitle}>📍 Venue</Text>
                    <Text style={styles.venueName}>{venue.name}</Text>
                    <Text style={styles.venueLocation}>{venue.city}</Text>
                  </View>
                )}

                {/* League Info */}
                <View style={styles.leagueSection}>
                  <Text style={styles.leagueTitle}>🏆 Competition</Text>
                  <Text style={styles.leagueName}>{match.league?.name}</Text>
                </View>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    maxHeight: '75%',
    minHeight: 300,
    marginBottom: 20, // Add space from bottom of screen
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 15,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  dateTimeSection: {
    alignItems: 'center',
    marginBottom: 25,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  timeText: {
    fontSize: 16,
    color: '#666',
  },
  teamsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    marginBottom: 10,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  vsContainer: {
    paddingHorizontal: 20,
  },
  vsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  venueSection: {
    marginBottom: 20,
  },
  venueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  venueName: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  venueLocation: {
    fontSize: 14,
    color: '#666',
  },
  leagueSection: {
    marginBottom: 20,
  },
  leagueTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  leagueName: {
    fontSize: 16,
    color: '#333',
  },
});

export default MatchModal; 