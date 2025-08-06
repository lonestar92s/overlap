import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/api';

const SavedMatchesContext = createContext();

export const useSavedMatches = () => {
  const context = useContext(SavedMatchesContext);
  if (!context) {
    throw new Error('useSavedMatches must be used within a SavedMatchesProvider');
  }
  return context;
};

export const SavedMatchesProvider = ({ children }) => {
  const [savedMatches, setSavedMatches] = useState(new Set());
  const [savedMatchesData, setSavedMatchesData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load saved matches from local storage on app start
  useEffect(() => {
    loadSavedMatchesFromStorage();
  }, []);

  // Load saved matches from local storage
  const loadSavedMatchesFromStorage = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedMatches');
      if (saved) {
        const savedSet = new Set(JSON.parse(saved));
        setSavedMatches(savedSet);
      }
    } catch (error) {
      console.error('Error loading saved matches from storage:', error);
    }
  };

  // Save matches to local storage
  const saveMatchesToStorage = async (matches) => {
    try {
      await AsyncStorage.setItem('savedMatches', JSON.stringify([...matches]));
    } catch (error) {
      console.error('Error saving matches to storage:', error);
    }
  };

  // Check if a match is saved
  const isMatchSaved = (matchId) => {
    return savedMatches.has(matchId);
  };

  // Save a match (heart it)
  const saveMatch = async (matchId, fixtureId, matchData) => {
    try {
      setLoading(true);
      
      // Optimistic update - update UI immediately
      const newSavedMatches = new Set(savedMatches);
      newSavedMatches.add(matchId);
      setSavedMatches(newSavedMatches);
      
      // Save to local storage
      await saveMatchesToStorage(newSavedMatches);
      
      // Save to backend
      await ApiService.saveMatch(matchId, fixtureId, matchData);
      
      // Update saved matches data
      setSavedMatchesData(prev => [matchData, ...prev]);
      
    } catch (error) {
      // Revert optimistic update on error
      const revertedMatches = new Set(savedMatches);
      revertedMatches.delete(matchId);
      setSavedMatches(revertedMatches);
      await saveMatchesToStorage(revertedMatches);
      
      console.error('Error saving match:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Unsave a match (unheart it)
  const unsaveMatch = async (matchId) => {
    try {
      setLoading(true);
      
      // Optimistic update - update UI immediately
      const newSavedMatches = new Set(savedMatches);
      newSavedMatches.delete(matchId);
      setSavedMatches(newSavedMatches);
      
      // Save to local storage
      await saveMatchesToStorage(newSavedMatches);
      
      // Remove from backend
      await ApiService.unsaveMatch(matchId);
      
      // Update saved matches data
      setSavedMatchesData(prev => prev.filter(match => match.matchId !== matchId));
      
    } catch (error) {
      // Revert optimistic update on error
      const revertedMatches = new Set(savedMatches);
      revertedMatches.add(matchId);
      setSavedMatches(revertedMatches);
      await saveMatchesToStorage(revertedMatches);
      
      console.error('Error unsaving match:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Toggle save state
  const toggleSaveMatch = async (matchId, fixtureId, matchData) => {
    if (isMatchSaved(matchId)) {
      await unsaveMatch(matchId);
    } else {
      await saveMatch(matchId, fixtureId, matchData);
    }
  };

  // Load saved matches from backend
  const loadSavedMatchesFromBackend = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getSavedMatches();
      
      // Extract match IDs from the response (existing API uses matchId field)
      const matchIds = response.savedMatches.map(match => match.matchId);
      const newSavedMatches = new Set(matchIds);
      
      setSavedMatches(newSavedMatches);
      setSavedMatchesData(response.savedMatches);
      await saveMatchesToStorage(newSavedMatches);
    } catch (error) {
      console.error('Error loading saved matches from backend:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get saved match count
  const getSavedMatchCount = () => {
    return savedMatches.size;
  };

  const value = {
    savedMatches,
    savedMatchesData,
    loading,
    isMatchSaved,
    saveMatch,
    unsaveMatch,
    toggleSaveMatch,
    loadSavedMatchesFromBackend,
    getSavedMatchCount
  };

  return (
    <SavedMatchesContext.Provider value={value}>
      {children}
    </SavedMatchesContext.Provider>
  );
}; 