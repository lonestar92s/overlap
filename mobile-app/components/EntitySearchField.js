import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { debounce } from 'lodash';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, input as inputTokens, iconSizes } from '../styles/designTokens';

/**
 * Combobox for memory/entity fields: search catalog results while allowing freeform text.
 * entityType: 'team' | 'league' | 'venue'
 */
const EntitySearchField = ({
  label,
  value = '',
  entityType,
  placeholder,
  onChangeText,
  onSelect,
  accessibilityLabel,
  selectedBadge = null,
  hint = null,
}) => {
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const skipNextSearchRef = useRef(false);
  const inputRef = useRef(null);

  const performSearch = useCallback(
    debounce(async (text, type) => {
      if (!text || text.trim().length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await ApiService.searchUnified(text.trim());
        if (!data?.success) {
          setResults([]);
          return;
        }
        const bucket =
          type === 'team' ? data.results?.teams
            : type === 'league' ? data.results?.leagues
              : data.results?.venues;
        setResults(Array.isArray(bucket) ? bucket.slice(0, 8) : []);
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350),
    []
  );

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setResults([]);
      setLoading(false);
      return;
    }
    if (!focused) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (value.trim().length >= 2) {
      setLoading(true);
      performSearch(value, entityType);
    } else {
      performSearch.cancel?.();
      setResults([]);
      setLoading(false);
    }
    return () => performSearch.cancel?.();
  }, [value, entityType, focused, performSearch]);

  const handleChangeText = (text) => {
    onChangeText?.(text);
  };

  const handleSelect = (item) => {
    skipNextSearchRef.current = true;
    setResults([]);
    setFocused(false);
    onSelect?.(item);
    // Blur after select so the dropdown stays tappable on press
    requestAnimationFrame(() => inputRef.current?.blur());
  };

  const subtitleFor = (item) => {
    if (entityType === 'league') return item.country || 'League';
    if (item.city) return `${item.city}${item.country ? `, ${item.country}` : ''}`;
    return item.country || (entityType === 'venue' ? 'Venue' : 'Team');
  };

  const showDropdown = focused && (loading || results.length > 0 || value.trim().length >= 2);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        {selectedBadge ? (
          <Image source={{ uri: selectedBadge }} style={styles.selectedBadge} resizeMode="contain" />
        ) : null}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.light}
          autoCapitalize="words"
          autoCorrect={false}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay so result taps register before dropdown closes
            setTimeout(() => setFocused(false), 180);
          }}
          accessibilityLabel={accessibilityLabel || label}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : value.length > 0 ? (
          <TouchableOpacity
            onPress={() => onChangeText?.('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Clear"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={iconSizes.sm} color={colors.text.secondary} />
          </TouchableOpacity>
        ) : (
          <MaterialIcons name="search" size={iconSizes.sm} color={colors.text.light} />
        )}
      </View>

      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {showDropdown && (
        <View style={styles.dropdown}>
          {loading && results.length === 0 ? (
            <Text style={styles.dropdownEmpty}>Searching…</Text>
          ) : results.length === 0 ? (
            <Text style={styles.dropdownEmpty}>
              No matches — keep typing to use “{value.trim()}”
            </Text>
          ) : (
            results.map((item) => (
              <TouchableOpacity
                key={`${entityType}-${item.id}`}
                style={styles.resultRow}
                onPressIn={() => handleSelect(item)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.name}`}
              >
                <View style={styles.resultIcon}>
                  {entityType === 'venue' && !item.badge ? (
                    <MaterialIcons name="stadium" size={22} color={colors.text.secondary} />
                  ) : item.badge ? (
                    <Image source={{ uri: item.badge }} style={styles.resultBadge} resizeMode="contain" />
                  ) : (
                    <View style={styles.resultBadgePlaceholder} />
                  )}
                </View>
                <View style={styles.resultText}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.resultSubtitle} numberOfLines={1}>{subtitleFor(item)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
    zIndex: 1,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    ...inputTokens,
    paddingVertical: 0,
    gap: spacing.sm,
  },
  inputRowFocused: {
    borderColor: colors.primary,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    margin: 0,
  },
  selectedBadge: {
    width: 24,
    height: 24,
  },
  hint: {
    ...typography.caption,
    color: colors.text.light,
    marginTop: spacing.xs,
  },
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    maxHeight: 220,
  },
  dropdownEmpty: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    fontStyle: 'italic',
    padding: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  resultIcon: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  resultBadge: {
    width: 28,
    height: 28,
  },
  resultBadgePlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultText: {
    flex: 1,
  },
  resultTitle: {
    ...typography.body,
    color: colors.text.primary,
  },
  resultSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
});

export default EntitySearchField;
