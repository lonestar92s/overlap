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

  const testConnection = async () => {
    console.log('🧪 Testing API connection...');
    try {
      const response = await fetch('https://friendly-gratitude-production-3f31.up.railway.app/api/search/natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'test' })
      });
      console.log('🧪 Test response status:', response.status);
      const data = await response.json();
      console.log('🧪 Test response data:', data);
      
      const testMessage = {
        id: Date.now().toString(),
        text: `Test successful! Status: ${response.status}`,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, testMessage]);
    } catch (error) {
      console.error('🧪 Test failed:', error);
      const errorMessage = {
        id: Date.now().toString(),
        text: `Test failed: ${error.message}`,
        isBot: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

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
        const botMessage = {
          id: (Date.now() + 1).toString(),
          text: formattedResponse.message || `Found ${formattedResponse.count} matches!`,
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
          // Use dynamic bounds based on map viewport instead of fixed bounds
          // This ensures all matches in the current map view are shown
          const viewportSpan = 0.5; // Reasonable default span for initial search
          apiParams.bounds = {
            northeast: { lat: location.coordinates[1] + viewportSpan, lng: location.coordinates[0] + viewportSpan },
            southwest: { lat: location.coordinates[1] - viewportSpan, lng: location.coordinates[0] - viewportSpan }
          };
          // Set initial region for map centering
          initialRegion = {
            latitude: location.coordinates[1],
            longitude: location.coordinates[0],
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
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
            />
            <Text style={styles.botName}>Match Assistant</Text>
            <Text style={styles.timestamp}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <Text style={styles.messageText}>{item.text}</Text>
          
          {item.data && (
            <View style={styles.searchResults}>
              <Text style={styles.resultsTitle}>Search Results:</Text>
              
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
              />
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
    >
      <Text style={styles.exampleText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Match Search Assistant</Text>
        <Text style={styles.headerSubtitle}>Ask me about football matches!</Text>
        <TouchableOpacity style={styles.testButton} onPress={testConnection}>
          <Text style={styles.testButtonText}>Test Connection</Text>
        </TouchableOpacity>
      </View>

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
              />
            }
            multiline
            maxLength={500}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#1976d2',
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  testButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    alignSelf: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 80,
  },
  messageCard: {
    marginVertical: 4,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  botMessage: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  userMessage: {
    backgroundColor: '#1976d2',
    marginLeft: 40,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  botAvatar: {
    backgroundColor: '#1976d2',
  },
  userAvatar: {
    backgroundColor: 'white',
  },
  botName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  searchResults: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  parsedSection: {
    marginBottom: 6,
  },
  parsedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  parsedValue: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  viewMatchesButton: {
    backgroundColor: '#1976d2',
    borderRadius: 8,
    marginTop: 12,
  },
  viewMatchesButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestions: {
    marginTop: 8,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  suggestionChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  suggestionText: {
    fontSize: 12,
    color: '#1976d2',
  },
  examplesContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  examplesList: {
    paddingRight: 16,
  },
  exampleChip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  exampleText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  inputField: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    backgroundColor: '#1976d2',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MessagesScreen;
