import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

const FilterContext = createContext();

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};

// Action types
const FILTER_ACTIONS = {
  UPDATE_FILTER_DATA: 'UPDATE_FILTER_DATA',
  UPDATE_SELECTED_FILTERS: 'UPDATE_SELECTED_FILTERS',
  TOGGLE_FILTER_MODAL: 'TOGGLE_FILTER_MODAL',
  OPEN_FILTER_MODAL: 'OPEN_FILTER_MODAL',
  CLOSE_FILTER_MODAL: 'CLOSE_FILTER_MODAL',
  CLEAR_ALL_FILTERS: 'CLEAR_ALL_FILTERS',
};

// Initial state
const initialState = {
  filterData: {
    countries: [],
    leagues: [],
    teams: [],
    matchIds: []
  },
  selectedFilters: {
    countries: [],
    leagues: [],
    teams: []
  },
  filterModalVisible: false
};

// Reducer function
const filterReducer = (state, action) => {
  switch (action.type) {
    case FILTER_ACTIONS.UPDATE_FILTER_DATA:
      return {
        ...state,
        filterData: action.payload
      };
    
    case FILTER_ACTIONS.UPDATE_SELECTED_FILTERS:
      return {
        ...state,
        selectedFilters: action.payload
      };
    
    case FILTER_ACTIONS.TOGGLE_FILTER_MODAL:
      return {
        ...state,
        filterModalVisible: !state.filterModalVisible
      };
    
    case FILTER_ACTIONS.OPEN_FILTER_MODAL:
      return {
        ...state,
        filterModalVisible: true
      };
    
    case FILTER_ACTIONS.CLOSE_FILTER_MODAL:
      return {
        ...state,
        filterModalVisible: false
      };
    
    case FILTER_ACTIONS.CLEAR_ALL_FILTERS:
      return {
        ...state,
        selectedFilters: {
          countries: [],
          leagues: [],
          teams: []
        }
      };
    
    default:
      return state;
  }
};

export const FilterProvider = ({ children }) => {
  const [state, dispatch] = useReducer(filterReducer, initialState);

  const updateFilterData = useCallback((data) => {
    dispatch({ type: FILTER_ACTIONS.UPDATE_FILTER_DATA, payload: data });
  }, []);

  const updateSelectedFilters = useCallback((filters) => {
    dispatch({ type: FILTER_ACTIONS.UPDATE_SELECTED_FILTERS, payload: filters });
  }, []);

  const toggleFilterModal = useCallback(() => {
    dispatch({ type: FILTER_ACTIONS.TOGGLE_FILTER_MODAL });
  }, []);

  const openFilterModal = useCallback(() => {
    dispatch({ type: FILTER_ACTIONS.OPEN_FILTER_MODAL });
  }, []);

  const closeFilterModal = useCallback(() => {
    dispatch({ type: FILTER_ACTIONS.CLOSE_FILTER_MODAL });
  }, []);

  const clearAllFilters = useCallback(() => {
    dispatch({ type: FILTER_ACTIONS.CLEAR_ALL_FILTERS });
  }, []);

  const getTotalFilters = useCallback(() => {
    return state.selectedFilters.countries.length + 
           state.selectedFilters.leagues.length + 
           state.selectedFilters.teams.length;
  }, [state.selectedFilters]);

  const value = useMemo(() => ({
    filterData: state.filterData,
    selectedFilters: state.selectedFilters,
    filterModalVisible: state.filterModalVisible,
    updateFilterData,
    updateSelectedFilters,
    toggleFilterModal,
    openFilterModal,
    closeFilterModal,
    clearAllFilters,
    getTotalFilters
  }), [
    state.filterData,
    state.selectedFilters,
    state.filterModalVisible,
    updateFilterData,
    updateSelectedFilters,
    toggleFilterModal,
    openFilterModal,
    closeFilterModal,
    clearAllFilters,
    getTotalFilters
  ]);

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};
