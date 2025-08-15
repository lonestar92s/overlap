import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { POPULAR_LEAGUES, getAllLeagues } from '../data/leagues';

const LeaguePicker = ({ selectedLeagues, onLeaguesChange, style = {} }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [showAllLeagues, setShowAllLeagues] = useState(false);

  const handleLeagueToggle = (leagueId) => {
    if (selectedLeagues.includes(leagueId)) {
      onLeaguesChange(selectedLeagues.filter(id => id !== leagueId));
    } else {
      onLeaguesChange([...selectedLeagues, leagueId]);
    }
  };

  const handleSelectAll = () => {
    const allLeagueIds = getAllLeagues().map(league => league.id);
    onLeaguesChange(allLeagueIds);
  };

  const handleClearAll = () => {
    onLeaguesChange([]);
  };

  const getSelectedLeaguesText = () => {
    if (selectedLeagues.length === 0) {
      return 'Select leagues...';
    }
    if (selectedLeagues.length === 1) {
      const league = getAllLeagues().find(l => l.id === selectedLeagues[0]);
      return league ? league.name : 'Unknown league';
    }
    return `${selectedLeagues.length} leagues selected`;
  };

  const renderLeagueItem = ({ item }) => {
    const isSelected = selectedLeagues.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.leagueItem, isSelected && styles.selectedLeagueItem]}
        onPress={() => handleLeagueToggle(item.id)}
      >
        <View style={styles.leagueInfo}>
          <Text style={[styles.leagueName, isSelected && styles.selectedLeagueName]}>
            {item.name}
          </Text>
          <Text style={[styles.leagueCountry, isSelected && styles.selectedLeagueCountry]}>
            {item.country}
          </Text>
        </View>
        {isSelected && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </TouchableOpacity>
    );
  };

  const leaguesToShow = showAllLeagues ? getAllLeagues() : POPULAR_LEAGUES;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.pickerButtonText}>
          {getSelectedLeaguesText()}
        </Text>
        <Text style={styles.pickerArrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalCloseButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Leagues</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.modalDoneButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleSelectAll}
            >
              <Text style={styles.controlButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleClearAll}
            >
              <Text style={styles.controlButtonText}>Clear All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, !showAllLeagues && styles.activeToggle]}
              onPress={() => setShowAllLeagues(false)}
            >
              <Text style={[styles.toggleText, !showAllLeagues && styles.activeToggleText]}>
                Popular
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, showAllLeagues && styles.activeToggle]}
              onPress={() => setShowAllLeagues(true)}
            >
              <Text style={[styles.toggleText, showAllLeagues && styles.activeToggleText]}>
                All Leagues
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={leaguesToShow}
            renderItem={renderLeagueItem}
            keyExtractor={(item, index) => (item.id || `league-${index}`).toString()}
            style={styles.leaguesList}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  pickerArrow: {
    fontSize: 12,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  modalCloseButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalDoneButton: {
    fontSize: 16,
    color: '#1976d2',
    fontWeight: '600',
  },
  modalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  controlButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  controlButtonText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#1976d2',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#fff',
  },
  leaguesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  leagueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectedLeagueItem: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#1976d2',
  },
  leagueInfo: {
    flex: 1,
  },
  leagueName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  selectedLeagueName: {
    color: '#1976d2',
  },
  leagueCountry: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  selectedLeagueCountry: {
    color: '#1976d2',
  },
  checkmark: {
    fontSize: 18,
    color: '#1976d2',
    fontWeight: 'bold',
  },
});

export default LeaguePicker; 