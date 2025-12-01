import React, { createContext, useContext, useState, useCallback } from 'react';

const FilterContext = createContext();

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};

export const FilterProvider = ({ children }) => {
  const [filterData, setFilterData] = useState({
    countries: [],
    leagues: [],
    teams: []
  });

  const [selectedFilters, setSelectedFilters] = useState({
    countries: [],
    leagues: [],
    teams: []
  });

  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const updateFilterData = useCallback((data) => {
    setFilterData(data);
  }, []);

  const updateSelectedFilters = useCallback((filters) => {
    setSelectedFilters(filters);
  }, []);

  const toggleFilterModal = useCallback(() => {
    setFilterModalVisible(prev => !prev);
  }, []);

  const openFilterModal = useCallback(() => {
    setFilterModalVisible(true);
  }, []);

  const closeFilterModal = useCallback(() => {
    setFilterModalVisible(false);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedFilters({
      countries: [],
      leagues: [],
      teams: []
    });
  }, []);

  const getTotalFilters = useCallback(() => {
    return selectedFilters.countries.length + 
           selectedFilters.leagues.length + 
           selectedFilters.teams.length;
  }, [selectedFilters]);

  const value = {
    filterData,
    selectedFilters,
    filterModalVisible,
    updateFilterData,
    updateSelectedFilters,
    toggleFilterModal,
    openFilterModal,
    closeFilterModal,
    clearAllFilters,
    getTotalFilters
  };

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};
