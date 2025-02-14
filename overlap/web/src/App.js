import React, { useState } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import HeaderNav from './components/HeaderNav';

const theme = createTheme({
  palette: {
    primary: {
      main: '#FF385C',
    },
    background: {
      default: '#F7F7F7',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

// Wrapper component to handle state and navigation
const AppContent = () => {
  const navigate = useNavigate();
  const [searchState, setSearchState] = useState({
    location: null,
    dates: { departure: null, return: null },
    matches: [],
    selectedMatches: [],
    selectedTransportation: {},
    loading: false,
    error: null
  });

  const handleReset = () => {
    setSearchState({
      location: null,
      dates: { departure: null, return: null },
      matches: [],
      selectedMatches: [],
      selectedTransportation: {},
      loading: false,
      error: null
    });
    navigate('/');
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <HeaderNav onHomeClick={handleReset} />
      <Routes>
        <Route path="/" element={<Home 
          searchState={searchState} 
          setSearchState={setSearchState} 
        />} />
      </Routes>
    </Box>
  );
};

function App() {
  const [searchState, setSearchState] = useState({
    location: null,
    dates: { departure: null, return: null },
    matches: [],
    selectedMatches: [],
    selectedTransportation: {},
    loading: false,
    error: null
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
