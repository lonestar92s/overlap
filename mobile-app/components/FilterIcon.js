import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Icon } from 'react-native-elements';

const FilterIcon = ({ onPress, activeFilterCount = 0, size = 24 }) => {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <Icon
        name="filter-list"
        type="material"
        size={size}
        color={activeFilterCount > 0 ? '#1976d2' : '#666'}
      />
      {activeFilterCount > 0 && (
        <Text style={styles.badge}>{activeFilterCount}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#1976d2',
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default FilterIcon;
