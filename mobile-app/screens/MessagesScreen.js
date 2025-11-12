import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Card, Input, Button, Avatar, ListItem } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { processNaturalLanguageQuery, formatSearchResults, getSearchExamples } from '../services/naturalLanguageService';
import ApiService from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../styles/designTokens';
import MatchCard from '../components/MatchCard';

const { width } = Dimensions.get('window');

const MessagesScreen = ({ navigation }) => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const flatListRef = useRef(null);

  const examples = getSearchExamples();

  useEffect(() => {
    // Add welcome message
    setMessages([{
      id: '1',
      text: "Hi! I'm your match search assistant. Ask me about football matches using natural language!",
      isBot: true,
      timestamp: new Date(),
    }]);
  }, []);

  const scrollToBottom = () => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);
    setShowExamples(false);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      console.log('🚀 MessagesScreen - Starting natural language query...');
      const response = await processNaturalLanguageQuery(inputText.trim(), messages);
      console.log('🚀 MessagesScreen - Got response:', response);
      
      const formattedResponse = formatSearchResults(response);
      console.log('🚀 MessagesScreen - Formatted response:', formattedResponse);

      if (formattedResponse.success) {
        const matchCount = formattedResponse.matches?.length || formattedResponse.count || 0;
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: formattedResponse.message || (matchCount > 0 
            ? `Found ${matchCount} ${matchCount === 1 ? 'match' : 'matches'}!` 
            : 'Search completed'),
          isBot: true,
          timestamp: new Date(),
          data: formattedResponse,
          type: 'search_results'
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: formattedResponse.message || "I couldn't understand that. Try being more specific!",
          isBot: true,
          timestamp: new Date(),
          suggestions: formattedResponse.suggestions || []
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('🚨 MessagesScreen - Error processing query:', error);
      console.error('🚨 MessagesScreen - Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        stack: error.stack
      });
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleExamplePress = (example) => {
    setInputText(example);
    setShowExamples(false);
  };

  const handleMatchPress = (match) => {
    // Navigate to match details or open match modal
    // For now, navigate to MapResults with this match selected
    navigation.navigate('SearchTab', {
      screen: 'MapResults',
      params: {
        matches: [match],
        initialRegion: match.fixture?.venue?.coordinates ? {
          latitude: match.fixture.venue.coordinates[1],
          longitude: match.fixture.venue.coordinates[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : null,
      }
    });
  };

  const handleSearchResultPress = async (data) => {
    try {
      setLoading(true);
      
      // Extract parsed parameters
      const location = data.parsed.location;
      const dateFrom = data.parsed.dateRange?.start || null;
      const dateTo = data.parsed.dateRange?.end || null;
      const leagues = data.parsed.leagues?.map(l => l.id) || [];
      const teams = data.parsed.teams?.map(t => t.id) || [];
      
      // Check if we have search criteria
      const hasLocation = !!location;
      const hasDates = !!(dateFrom && dateTo);
      const hasWho = (leagues.length + teams.length) > 0;
      
      // Validate search parameters (same logic as SearchScreen)
      if (!hasWho) {
        if (!hasLocation) {
          Alert.alert('Error', 'Please select a location');
          return;
        }
        if (!hasDates) {
          Alert.alert('Error', 'Please select your travel dates');
          return;
        }
      }
      
      if (hasWho && !hasLocation && !hasDates) {
        Alert.alert('Error', 'Please select at least a location or travel dates when searching by teams/leagues');
        return;
      }
      
      const searchParams = {
        location,
        dateFrom,
        dateTo
      };
      
      let matches = [];
      let initialRegion = null;
      let autoFitKey = 0;
      
      if (hasWho) {
        // Global search by leagues/teams
        const apiParams = {
          competitions: leagues.map(l => String(l)),
          teams: teams.map(t => String(t)),
        };
        
        // Add optional date range if provided
        if (hasDates) {
          apiParams.dateFrom = searchParams.dateFrom;
          apiParams.dateTo = searchParams.dateTo;
        }
        
        // Add optional bounds if location is provided
        if (hasLocation) {
          // Use exact viewport bounds (no buffer) - matches initialRegion exactly
          const viewportDelta = 0.5; // Default viewport size
          apiParams.bounds = {
            northeast: { 
              lat: location.coordinates[1] + (viewportDelta / 2), 
              lng: location.coordinates[0] + (viewportDelta / 2) 
            },
            southwest: { 
              lat: location.coordinates[1] - (viewportDelta / 2), 
              lng: location.coordinates[0] - (viewportDelta / 2) 
            }
          };
          // Set initial region for map centering (matches bounds exactly)
          initialRegion = {
            latitude: location.coordinates[1],
            longitude: location.coordinates[0],
            latitudeDelta: viewportDelta,
            longitudeDelta: viewportDelta,
          };
        }
        
        console.log('MessagesScreen: Calling searchAggregatedMatches with params:', apiParams);
        
        const agg = await ApiService.searchAggregatedMatches(apiParams);
        console.log('MessagesScreen: searchAggregatedMatches response:', agg);
        matches = agg?.data || [];
        console.log('MessagesScreen: Final matches from aggregated search:', matches);
        autoFitKey = Date.now(); // trigger map to auto-fit
      } else {
        // Traditional bounds-based search (requires both location and dates)
        const bounds = {
          northeast: { lat: location.coordinates[1] + 0.25, lng: location.coordinates[0] + 0.25 },
          southwest: { lat: location.coordinates[1] - 0.25, lng: location.coordinates[0] - 0.25 }
        };
        const response = await ApiService.searchMatchesByBounds({
          bounds,
          dateFrom: searchParams.dateFrom,
          dateTo: searchParams.dateTo
        });
        matches = response.data || [];
        
        // Set initial region for bounds-based search
        initialRegion = {
          latitude: location.coordinates[1],
          longitude: location.coordinates[0],
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        };
      }
      
      // Navigate to MapResults with the search results
      navigation.navigate('SearchTab', {
        screen: 'MapResults',
        params: { 
          searchParams,
          matches,
          initialRegion,
          autoFitKey,
          hasLocation,
          hasDates,
          hasWho,
          preSelectedFilters: data.preSelectedFilters // Pass pre-selected filters from natural language search
        }
      });
      
    } catch (error) {
      console.error('MessagesScreen: Search error:', error);
      Alert.alert('Error', error.message || 'Failed to search matches');
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    if (item.type === 'search_results') {
      return (
        <Card containerStyle={[styles.messageCard, styles.botMessage]}>
          <View style={styles.messageHeader}>
            <Avatar
              size="small"
              rounded
              icon={{ name: 'search', type: 'material' }}
              containerStyle={styles.botAvatar}
              accessibilityLabel="Match Assistant avatar"
              accessibilityRole="image"
            />
            <Text style={styles.botName}>Match Assistant</Text>
            <Text style={styles.timestamp}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={styles.messageText}>{item.text}</Text>
          
          {item.data && (
            <View style={styles.searchResults}>
              {/* Show match cards if matches are available */}
              {item.data.matches && item.data.matches.length > 0 ? (
                <View style={styles.matchesContainer}>
                  <Text style={styles.resultsTitle}>
                    Found {item.data.matches.length} {item.data.matches.length === 1 ? 'match' : 'matches'}:
                  </Text>
                  {item.data.matches.map((match, index) => (
                    <MatchCard
                      key={match.fixture?.id || match.id || `match-${index}`}
                      match={match}
                      onPress={() => handleMatchPress(match)}
                      variant="default"
                      showHeart={true}
                      style={styles.matchCardInMessage}
                    />
                  ))}
                  {item.data.count > item.data.matches.length && (
                    <Text style={styles.moreMatchesText}>
                      Showing {item.data.matches.length} of {item.data.count} matches
                    </Text>
                  )}
                  <Button
                    title="View All on Map"
                    onPress={() => handleSearchResultPress(item.data)}
                    buttonStyle={styles.viewMatchesButton}
                    titleStyle={styles.viewMatchesButtonText}
                    accessibilityLabel="View all matches on map"
                    accessibilityRole="button"
                  />
                </View>
              ) : (
                <>
                  {/* Show parsed search criteria if no matches yet */}
                  <Text style={styles.resultsTitle}>Search Criteria:</Text>
                  
                  {item.data.parsed.teams.length > 0 && (
                    <View style={styles.parsedSection}>
                      <Text style={styles.parsedLabel}>Teams:</Text>
                      <Text style={styles.parsedValue}>
                        {item.data.parsed.teams.map(t => t.name).join(', ')}
                      </Text>
                    </View>
                  )}
                  
                  {item.data.parsed.leagues.length > 0 && (
                    <View style={styles.parsedSection}>
                      <Text style={styles.parsedLabel}>Leagues:</Text>
                      <Text style={styles.parsedValue}>
                        {item.data.parsed.leagues.map(l => l.name).join(', ')}
                      </Text>
                    </View>
                  )}
                  
                  {item.data.parsed.location && item.data.parsed.location.city && item.data.parsed.location.country && (
                    <View style={styles.parsedSection}>
                      <Text style={styles.parsedLabel}>Location:</Text>
                      <Text style={styles.parsedValue}>
                        {item.data.parsed.location.city}, {item.data.parsed.location.country}
                      </Text>
                    </View>
                  )}
                  
                  {item.data.parsed.dateRange && (
                    <View style={styles.parsedSection}>
                      <Text style={styles.parsedLabel}>Dates:</Text>
                      <Text style={styles.parsedValue}>
                        {item.data.parsed.dateRange.start} to {item.data.parsed.dateRange.end}
                      </Text>
                    </View>
                  )}

                  <Button
                    title="View Matches"
                    onPress={() => handleSearchResultPress(item.data)}
                    buttonStyle={styles.viewMatchesButton}
                    titleStyle={styles.viewMatchesButtonText}
                    accessibilityLabel="View matches on map"
                    accessibilityRole="button"
                  />
                </>
              )}
            </View>
          )}
        </Card>
      );
    }

    return (
      <Card containerStyle={[
        styles.messageCard,
        item.isBot ? styles.botMessage : styles.userMessage
      ]}>
        <View style={styles.messageHeader}>
          <Avatar
            size="small"
            rounded
            icon={{ 
              name: item.isBot ? 'smart-toy' : 'person', 
              type: 'material' 
            }}
            containerStyle={item.isBot ? styles.botAvatar : styles.userAvatar}
            accessibilityLabel={item.isBot ? 'Match Assistant avatar' : 'Your avatar'}
            accessibilityRole="image"
          />
          <Text style={item.isBot ? styles.botName : styles.userName}>
            {item.isBot ? 'Match Assistant' : 'You'}
          </Text>
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <Text style={styles.messageText}>{item.text}</Text>
        
        {item.suggestions && item.suggestions.length > 0 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsTitle}>Try these:</Text>
            {item.suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionChip}
                onPress={() => setInputText(suggestion)}
                accessibilityLabel={`Use suggestion: ${suggestion}`}
                accessibilityRole="button"
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Card>
    );
  };

  const renderExample = ({ item }) => (
    <TouchableOpacity
      style={styles.exampleChip}
      onPress={() => handleExamplePress(item)}
      accessibilityLabel={`Try example: ${item}`}
      accessibilityRole="button"
    >
      <Text style={styles.exampleText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      />

      {showExamples && messages.length === 1 && (
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Try asking:</Text>
          <FlatList
            data={examples}
            renderItem={renderExample}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.examplesList}
          />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
      >
        <View style={styles.inputRow}>
          <Input
            placeholder="Ask about matches..."
            value={inputText}
            onChangeText={setInputText}
            containerStyle={styles.inputWrapper}
            inputContainerStyle={styles.inputField}
            rightIcon={
              <Button
                title="Send"
                onPress={handleSendMessage}
                disabled={!inputText.trim() || loading}
                loading={loading}
                buttonStyle={styles.sendButton}
                titleStyle={styles.sendButtonText}
                size="small"
                accessibilityLabel="Send message"
                accessibilityRole="button"
              />
            }
            multiline
            maxLength={500}
            accessibilityLabel="Message input"
            accessibilityRole="textbox"
            accessibilityHint="Type your question about football matches here"
          />
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
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  messageCard: {
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  botMessage: {
    backgroundColor: colors.cardGrey,
    borderLeftWidth: spacing.xs,
    borderLeftColor: colors.primary,
  },
  userMessage: {
    backgroundColor: colors.primary,
    marginLeft: spacing.xl,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  botAvatar: {
    backgroundColor: colors.primary,
  },
  userAvatar: {
    backgroundColor: colors.card,
  },
  botName: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  userName: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.onPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  timestamp: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  messageText: {
    ...typography.body,
    color: colors.text.primary,
  },
  searchResults: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultsTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  parsedSection: {
    marginBottom: spacing.sm,
  },
  parsedLabel: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  parsedValue: {
    ...typography.bodySmall,
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  viewMatchesButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
    marginTop: spacing.md,
  },
  viewMatchesButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  suggestions: {
    marginTop: spacing.sm,
  },
  suggestionsTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  suggestionChip: {
    backgroundColor: colors.status.attendancePromptBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  suggestionText: {
    ...typography.caption,
    color: colors.primary,
  },
  examplesContainer: {
    padding: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  examplesTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  examplesList: {
    paddingRight: spacing.md,
  },
  exampleChip: {
    backgroundColor: colors.status.attendancePromptBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    marginRight: spacing.sm,
  },
  exampleText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
  },
  inputWrapper: {
    flex: 1,
    marginRight: spacing.sm,
  },
  inputField: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.cardGrey,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButtonText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  matchesContainer: {
    marginTop: spacing.md,
  },
  matchCardInMessage: {
    marginBottom: spacing.sm,
  },
  moreMatchesText: {
    ...typography.caption,
    color: colors.text.secondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
});

export default MessagesScreen;
