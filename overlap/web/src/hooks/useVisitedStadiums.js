import { useState, useEffect, useCallback } from 'react';

const useVisitedStadiums = () => {
  const [visitedStadiums, setVisitedStadiums] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load visited stadiums from API
  const loadVisitedStadiums = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:3001/api/preferences/visited-stadiums', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setVisitedStadiums(data.visitedStadiums);
      }
    } catch (error) {
      console.error('Error loading visited stadiums:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Add visited stadium
  const addVisitedStadium = useCallback(async (match) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const venue = match.fixture.venue;
      const venueId = venue.id?.toString() || `${venue.name}-${venue.city}`;

      // Optimistically update state
      const newStadium = {
        venueId,
        venueName: venue.name,
        city: venue.city,
        country: venue.country || 'Unknown',
        visitedDate: new Date().toISOString()
      };
      setVisitedStadiums(prev => [...prev, newStadium]);

      const response = await fetch('http://localhost:3001/api/preferences/visited-stadiums', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          venueId,
          venueName: venue.name,
          city: venue.city,
          country: venue.country || 'Unknown'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add visited stadium');
      }

      const data = await response.json();
      setVisitedStadiums(data.visitedStadiums);
    } catch (error) {
      console.error('Error adding visited stadium:', error);
      // Revert optimistic update on error
      const venue = match.fixture.venue;
      const venueId = venue.id?.toString() || `${venue.name}-${venue.city}`;
      setVisitedStadiums(prev => prev.filter(stadium => stadium.venueId !== venueId));
    }
  }, []);

  // Remove visited stadium
  const removeVisitedStadium = useCallback(async (venueId) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Store the stadium we're about to remove for potential rollback
    const removedStadium = visitedStadiums.find(stadium => stadium.venueId === venueId);
    
    try {
      // Optimistically update state
      setVisitedStadiums(prev => prev.filter(stadium => stadium.venueId !== venueId));

      const response = await fetch(`http://localhost:3001/api/preferences/visited-stadiums/${venueId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to remove visited stadium');
      }

      const data = await response.json();
      setVisitedStadiums(data.visitedStadiums);
    } catch (error) {
      console.error('Error removing visited stadium:', error);
      // Revert optimistic update on error
      if (removedStadium) {
        setVisitedStadiums(prev => [...prev, removedStadium]);
      }
    }
  }, [visitedStadiums]);

  // Check if a stadium is visited
  const isStadiumVisited = useCallback((match) => {
    const venue = match.fixture.venue;
    const venueId = venue.id?.toString() || `${venue.name}-${venue.city}`;
    return visitedStadiums.some(stadium => stadium.venueId === venueId);
  }, [visitedStadiums]);

  // Handle stadium click (toggle visited state)
  const handleStadiumClick = useCallback(async (match) => {
    const venue = match.fixture.venue;
    const venueId = venue.id?.toString() || `${venue.name}-${venue.city}`;
    
    const isVisited = visitedStadiums.some(stadium => stadium.venueId === venueId);
    
    if (isVisited) {
      await removeVisitedStadium(venueId);
    } else {
      await addVisitedStadium(match);
    }
  }, [visitedStadiums, addVisitedStadium, removeVisitedStadium]);

  // Load data on mount
  useEffect(() => {
    loadVisitedStadiums();
  }, [loadVisitedStadiums]);

  return {
    visitedStadiums,
    loading,
    addVisitedStadium,
    removeVisitedStadium,
    isStadiumVisited,
    handleStadiumClick,
    refreshVisitedStadiums: loadVisitedStadiums
  };
};

export default useVisitedStadiums; 