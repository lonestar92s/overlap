import React, { createContext, useContext, useState, useEffect } from 'react';
import ApiService from '../services/api';
import { normalizeId, normalizeIds, idsEqual, getDocumentId } from '../utils/idNormalizer';

const ItineraryContext = createContext();

export const useItineraries = () => {
  const context = useContext(ItineraryContext);
  if (!context) {
    throw new Error('useItineraries must be used within an ItineraryProvider');
  }
  return context;
};

export const ItineraryProvider = ({ children }) => {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load itineraries from backend API on app start
  useEffect(() => {
    loadItinerariesFromAPI();
  }, []);

  // Load itineraries from backend API
  const loadItinerariesFromAPI = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getTrips();
      if (response.success && response.trips) {
        // Normalize all trip IDs when loading
        const normalizedTrips = normalizeIds(response.trips);
        setItineraries(normalizedTrips);
      }
    } catch (error) {
      console.error('Error loading itineraries from API:', error);
      // Fallback to empty array on error
      setItineraries([]);
    } finally {
      setLoading(false);
    }
  };

  // Create a new itinerary
  const createItinerary = async (name, destination, startDate, endDate) => {
    try {
      console.log('🆕 Creating itinerary with name:', name);
      const response = await ApiService.createTrip(name);
      console.log('🆕 API response:', response);
      
      if (response.success && response.trip) {
        const newItinerary = normalizeId(response.trip);
        console.log('🆕 New itinerary normalized:', { id: newItinerary.id, _id: newItinerary._id });
        setItineraries(prev => [...prev, newItinerary]);
        return newItinerary;
      } else {
        throw new Error('Failed to create trip via API');
      }
    } catch (error) {
      console.error('Error creating itinerary via API:', error);
      throw error;
    }
  };

  // Add a match to an itinerary
  const addMatchToItinerary = async (itineraryId, matchData) => {
    try {
      console.log('➕ Adding match to itinerary:', { 
        itineraryId, 
        matchId: matchData.matchId,
        matchData: JSON.stringify(matchData, null, 2) 
      });
      
      const response = await ApiService.addMatchToTrip(itineraryId, matchData);
      console.log('➕ API response:', response);
      
      if (response.success && response.trip) {
        const updatedTrip = normalizeId(response.trip);
        console.log('➕ Updated trip normalized:', { id: updatedTrip.id, _id: updatedTrip._id });
        console.log('➕ Updated trip matches:', updatedTrip.matches.map(m => ({ matchId: m.matchId, fixtureId: m.fixtureId })));
        
        // Update local state with the updated trip from API
        setItineraries(prev => {
          const updated = prev.map(itinerary => 
            idsEqual(itinerary.id || itinerary._id, itineraryId) ? updatedTrip : itinerary
          );
          console.log('➕ Local state updated, new itineraries count:', updated.length);
          return updated;
        });
      } else {
        throw new Error('Failed to add match to trip via API');
      }
    } catch (error) {
      console.error('Error adding match to itinerary via API:', error);
      throw error;
    }
  };

  // Update match planning details
  const updateMatchPlanning = async (itineraryId, matchId, planningData) => {
    try {
      console.log('📋 Updating match planning:', { itineraryId, matchId, planningData });
      
      const response = await ApiService.updateMatchPlanning(itineraryId, matchId, planningData);
      console.log('📋 Planning update response:', response);
      
      if (response.success && response.data.trip) {
        const updatedTrip = normalizeId(response.data.trip);
        console.log('📋 Updated trip from API:', updatedTrip);
        
        // Update local state with the updated trip from API
        setItineraries(prev => prev.map(itinerary => 
          idsEqual(itinerary.id || itinerary._id, itineraryId) ? updatedTrip : itinerary
        ));
        
        return updatedTrip;
      } else {
        throw new Error('Failed to update match planning via API');
      }
    } catch (error) {
      console.error('Error updating match planning:', error);
      throw error;
    }
  };

  // Remove a match from an itinerary
  const removeMatchFromItinerary = async (itineraryId, matchId) => {
    try {
      // Try to use the backend API first
      try {
        const response = await ApiService.removeMatchFromTrip(itineraryId, matchId);
        if (response.success) {
          // Update local state with the updated trip from API
          setItineraries(prev => prev.map(itinerary => {
            if (idsEqual(itinerary.id || itinerary._id, itineraryId)) {
              return {
                ...itinerary,
                matches: itinerary.matches.filter(match => {
                  const matchIdStr = String(matchId);
                  return !idsEqual(match.matchId, matchIdStr) && 
                         !idsEqual(match.id, matchIdStr);
                }),
                updatedAt: new Date().toISOString()
              };
            }
            return itinerary;
          }));
          return;
        }
      } catch (apiError) {
        console.log('🔄 Backend API not available, using local state update');
      }
      
      // Fallback to local state update if API fails
      setItineraries(prev => prev.map(itinerary => {
        if (idsEqual(itinerary.id || itinerary._id, itineraryId)) {
          return {
            ...itinerary,
            matches: itinerary.matches.filter(match => {
              const matchIdStr = String(matchId);
              return !idsEqual(match.matchId, matchIdStr) && 
                     !idsEqual(match.id, matchIdStr);
            }),
            updatedAt: new Date().toISOString()
          };
        }
        return itinerary;
      }));
    } catch (error) {
      console.error('Error removing match from itinerary:', error);
      throw error;
    }
  };

  // Update itinerary details
  const updateItinerary = async (itineraryId, updates) => {
    try {
      console.log('🔄 Updating itinerary:', { itineraryId, updates });
      
      const response = await ApiService.updateTrip(itineraryId, updates);
      console.log('🔄 API response:', response);
      
      if (response.success && response.trip) {
        const updatedTrip = normalizeId(response.trip);
        console.log('🔄 Updated trip from API:', updatedTrip);
        
        // Update local state with the updated trip from API
        setItineraries(prev => prev.map(itinerary => 
          idsEqual(itinerary.id || itinerary._id, itineraryId) ? updatedTrip : itinerary
        ));
        
        return updatedTrip;
      } else {
        throw new Error('Failed to update trip via API');
      }
    } catch (error) {
      console.error('Error updating itinerary via API:', error);
      throw error;
    }
  };

  // Delete an itinerary
  const deleteItinerary = async (itineraryId) => {
    try {
      console.log('🗑️ Attempting to delete itinerary:', itineraryId);
      
      // Try to use the backend API first
      try {
        const response = await ApiService.deleteTrip(itineraryId);
        console.log('🗑️ Backend delete response:', response);
        
        if (response.success) {
          // Remove from local state
          setItineraries(prev => prev.filter(itinerary => 
            !idsEqual(itinerary.id || itinerary._id, itineraryId)
          ));
          console.log('✅ Itinerary deleted successfully via API');
          return;
        } else {
          throw new Error('Failed to delete trip via API');
        }
      } catch (apiError) {
        console.log('🔄 Backend API failed, using local state update:', apiError.message);
      }
      
      // Fallback to local state update if API fails
      setItineraries(prev => prev.filter(itinerary => 
        !idsEqual(itinerary.id || itinerary._id, itineraryId)
      ));
      console.log('✅ Itinerary deleted from local state (backend API unavailable)');
      
    } catch (error) {
      console.error('Error deleting itinerary:', error);
      throw error;
    }
  };

  // Get itinerary by ID
  const getItineraryById = (itineraryId) => {
    return itineraries.find(itinerary => 
      idsEqual(itinerary.id || itinerary._id, itineraryId)
    );
  };

  // Check if a match is in any itinerary
  const isMatchInItinerary = (matchId) => {
    const normalizedMatchId = String(matchId);
    
    const result = itineraries.some(itinerary => {
      const hasMatch = itinerary.matches.some(match => {
        // Check multiple possible ID fields to handle different data sources
        const matchFound = idsEqual(match.matchId, normalizedMatchId) || 
                          idsEqual(match.fixtureId, normalizedMatchId) || 
                          idsEqual(match.id, normalizedMatchId) ||
                          idsEqual(match.fixture?.id, normalizedMatchId);
        
        if (matchFound) {
          console.log('✅ Match found in itinerary:', { 
            itineraryName: itinerary.name, 
            matchId: match.matchId, 
            fixtureId: match.fixtureId,
            matchIdFromMatch: match.id,
            fixtureIdFromFixture: match.fixture?.id,
            normalizedMatchId
          });
        }
        return matchFound;
      });
      return hasMatch;
    });
    
    return result;
  };

  // Get all itineraries containing a specific match
  const getItinerariesForMatch = (matchId) => {
    const normalizedMatchId = String(matchId);
    
    return itineraries.filter(itinerary => 
      itinerary.matches.some(match => 
        idsEqual(match.matchId, normalizedMatchId) || 
        idsEqual(match.fixtureId, normalizedMatchId) || 
        idsEqual(match.id, normalizedMatchId) ||
        idsEqual(match.fixture?.id, normalizedMatchId)
      )
    );
  };

  const value = {
    itineraries,
    loading,
    createItinerary,
    addMatchToItinerary,
    updateMatchPlanning,
    removeMatchFromItinerary,
    updateItinerary,
    deleteItinerary,
    getItineraryById,
    isMatchInItinerary,
    getItinerariesForMatch,
    refreshItineraries: loadItinerariesFromAPI
  };

  return (
    <ItineraryContext.Provider value={value}>
      {children}
    </ItineraryContext.Provider>
  );
};
