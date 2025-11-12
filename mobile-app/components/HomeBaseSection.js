import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import HomeBaseSelector from './HomeBaseSelector';
import { colors, spacing, typography, borderRadius } from '../styles/designTokens';
import apiService from '../services/api';

const HomeBaseSection = ({ tripId, homeBases = [], onHomeBasesUpdated, tripDateRange = null }) => {
  const [expanded, setExpanded] = useState(false);
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [editingHomeBase, setEditingHomeBase] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const formatDateRange = (from, to) => {
    if (!from || !to) return '';
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const fromStr = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const toStr = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fromStr} - ${toStr}`;
  };

  const formatLocation = (homeBase) => {
    if (homeBase.address?.city && homeBase.address?.country) {
      return `${homeBase.address.city}, ${homeBase.address.country}`;
    }
    return homeBase.name;
  };

  const handleAddHomeBase = () => {
    setEditingHomeBase(null);
    setSelectorVisible(true);
  };

  const handleEditHomeBase = (homeBase) => {
    setEditingHomeBase(homeBase);
    setSelectorVisible(true);
  };

  const handleDeleteHomeBase = (homeBaseId) => {
    Alert.alert(
      'Delete Home Base',
      'Are you sure you want to delete this home base?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(homeBaseId);
            try {
              await apiService.deleteHomeBaseFromTrip(tripId, homeBaseId);
              if (onHomeBasesUpdated) {
                onHomeBasesUpdated();
              }
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete home base');
            } finally {
              setDeletingId(null);
            }
          }
        }
      ]
    );
  };

  const handleSaveHomeBase = async (homeBaseData) => {
    try {
      if (editingHomeBase) {
        // Update existing
        await apiService.updateHomeBaseInTrip(tripId, editingHomeBase._id, homeBaseData);
      } else {
        // Add new
        await apiService.addHomeBaseToTrip(tripId, homeBaseData);
      }
      
      if (onHomeBasesUpdated) {
        onHomeBasesUpdated();
      }
      
      setSelectorVisible(false);
      setEditingHomeBase(null);
    } catch (error) {
      throw error; // Let HomeBaseSelector handle the error display
    }
  };

  const renderHomeBaseItem = ({ item }) => {
    const isDeleting = deletingId === item._id;
    
    return (
      <View style={styles.homeBaseItem}>
        <View style={styles.homeBaseContent}>
          <View style={styles.homeBaseHeader}>
            <MaterialIcons 
              name={item.type === 'hotel' ? 'hotel' : item.type === 'airbnb' ? 'home' : 'location-on'} 
              size={20} 
              color={colors.primary} 
            />
            <Text style={styles.homeBaseName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          
          <Text style={styles.homeBaseLocation} numberOfLines={1}>
            {formatLocation(item)}
          </Text>
          
          {item.dateRange && (
            <Text style={styles.homeBaseDateRange}>
              {formatDateRange(item.dateRange.from, item.dateRange.to)}
            </Text>
          )}
        </View>
        
        <View style={styles.homeBaseActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditHomeBase(item)}
            disabled={isDeleting}
          >
            <MaterialIcons name="edit" size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteHomeBase(item._id)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <MaterialIcons name="delete" size={18} color={colors.error} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>Home Bases</Text>
        <View style={styles.sectionHeaderRight}>
          {homeBases.length > 0 && (
            <Text style={styles.countText}>
              {homeBases.length} {homeBases.length === 1 ? 'base' : 'bases'}
            </Text>
          )}
          <MaterialIcons
            name={expanded ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={24}
            color={colors.text.primary}
          />
        </View>
      </TouchableOpacity>
      
      {expanded && (
        <View style={styles.sectionContent}>
          {homeBases.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="home" size={48} color={colors.text.light} />
              <Text style={styles.emptyStateText}>
                No home bases added yet
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Add where you're staying to calculate travel times to matches
              </Text>
            </View>
          ) : (
            <FlatList
              data={homeBases}
              renderItem={renderHomeBaseItem}
              keyExtractor={(item) => item._id?.toString() || item.id?.toString() || `homebase-${item.name}`}
              scrollEnabled={false}
            />
          )}
          
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddHomeBase}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add" size={20} color={colors.primary} />
            <Text style={styles.addButtonText}>Add Home Base</Text>
          </TouchableOpacity>
        </View>
      )}

      <HomeBaseSelector
        visible={selectorVisible}
        onClose={() => {
          setSelectorVisible(false);
          setEditingHomeBase(null);
        }}
        onSave={handleSaveHomeBase}
        homeBase={editingHomeBase}
        tripDateRange={tripDateRange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
    ...typography.shadow,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '600',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  countText: {
    ...typography.body,
    color: colors.text.secondary,
    marginRight: spacing.xsmall,
  },
  sectionContent: {
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.large,
  },
  emptyStateText: {
    ...typography.body,
    color: colors.text.primary,
    marginTop: spacing.medium,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xsmall,
    textAlign: 'center',
  },
  homeBaseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  homeBaseContent: {
    flex: 1,
    marginRight: spacing.small,
  },
  homeBaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.xsmall,
  },
  homeBaseName: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  homeBaseLocation: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xsmall,
  },
  homeBaseDateRange: {
    ...typography.caption,
    color: colors.text.light,
  },
  homeBaseActions: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  actionButton: {
    padding: spacing.small,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.small,
    padding: spacing.medium,
    marginTop: spacing.medium,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default HomeBaseSection;

