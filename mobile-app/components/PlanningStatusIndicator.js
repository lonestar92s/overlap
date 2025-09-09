import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PlanningStatusIndicator = ({ planning, size = 'small' }) => {
  if (!planning) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'yes': return '#6BCF7F';
      case 'in-progress': return '#FFD93D';
      case 'no': return '#FF6B6B';
      default: return '#CCCCCC';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'yes': return 'check-circle';
      case 'in-progress': return 'schedule';
      case 'no': return 'cancel';
      default: return 'help';
    }
  };

  const isSmall = size === 'small';
  const iconSize = isSmall ? 12 : 16;
  const containerSize = isSmall ? 20 : 24;

  const items = [
    { key: 'ticketsAcquired', label: 'Tickets', icon: 'confirmation-number' },
    { key: 'flight', label: 'Flight', icon: 'flight' },
    { key: 'accommodation', label: 'Hotel', icon: 'hotel' }
  ];

  return (
    <View style={[styles.container, isSmall && styles.containerSmall]}>
      {items.map((item) => {
        const status = planning[item.key] || 'no';
        const color = getStatusColor(status);
        const icon = getStatusIcon(status);
        
        return (
          <View key={item.key} style={[styles.statusItem, isSmall && styles.statusItemSmall]}>
            <View style={[
              styles.statusIcon, 
              { backgroundColor: color, width: containerSize, height: containerSize },
              isSmall && styles.statusIconSmall
            ]}>
              <Icon 
                name={icon} 
                size={iconSize} 
                color="#FFFFFF" 
              />
            </View>
            {!isSmall && (
              <Text style={styles.statusLabel}>{item.label}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginTop: 8
  },
  containerSmall: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    marginTop: 4
  },
  statusItem: {
    alignItems: 'center',
    flex: 1
  },
  statusItemSmall: {
    marginHorizontal: 2
  },
  statusIcon: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  statusIconSmall: {
    borderRadius: 10,
    marginBottom: 0
  },
  statusLabel: {
    fontSize: 10,
    color: '#666666',
    textAlign: 'center'
  }
});

export default PlanningStatusIndicator;
