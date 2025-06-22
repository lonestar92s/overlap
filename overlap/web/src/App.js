import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import HeaderNav from './components/HeaderNav';
import Auth from './components/Auth';
import Profile from './components/Profile';

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
  const [user, setUser] = useState(null);
  const [searchState, setSearchState] = useState({
    location: null,
    dates: { departure: null, return: null },
    matches: [],
    loading: false,
    error: null
  });

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    navigate('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  const handleReset = () => {
    setSearchState({
      location: null,
      dates: { departure: null, return: null },
      matches: [],
      loading: false,
      error: null
    });
    navigate('/');
  };

  // Show auth screen if user is not logged in
  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <HeaderNav onHomeClick={handleReset} user={user} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<Home 
          searchState={searchState} 
          setSearchState={setSearchState} 
        />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Box>
  );
};

function App() {
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
