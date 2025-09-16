import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Badge } from 'react-native-elements';

const TierBadge = ({ tier = 'freemium', style }) => {
  const getTierConfig = (userTier) => {
    switch (userTier) {
      case 'freemium':
        return {
          value: 'FREE',
          status: 'success',
          backgroundColor: '#4CAF50',
          textColor: '#FFFFFF'
        };
      case 'pro':
        return {
          value: 'PRO',
          status: 'warning',
          backgroundColor: '#FF9800',
          textColor: '#FFFFFF'
        };
      case 'planner':
        return {
          value: 'PLANNER',
          status: 'error',
          backgroundColor: '#9C27B0',
          textColor: '#FFFFFF'
        };
      default:
        return {
          value: 'FREE',
          status: 'success',
          backgroundColor: '#4CAF50',
          textColor: '#FFFFFF'
        };
    }
  };

  const config = getTierConfig(tier);

  return (
    <View style={[styles.container, style]}>
      <Badge
        value={config.value}
        status={config.status}
        badgeStyle={[
          styles.badge,
          { backgroundColor: config.backgroundColor }
        ]}
        textStyle={[
          styles.badgeText,
          { color: config.textColor }
        ]}
        containerStyle={styles.badgeContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 10,
    zIndex: 1000,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  badgeContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default TierBadge;
