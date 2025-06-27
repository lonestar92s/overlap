import React, { useState, useEffect, useContext } from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import HeaderNav from './components/HeaderNav';
import Auth, { AuthContext, AuthProvider } from './components/Auth';
import Profile from './components/Profile';
import Trips from './components/Trips';
import Preferences from './components/Preferences';
import Stadiums from './components/Stadiums';
import Explore from './components/Explore';
import AttendedMatches from './components/AttendedMatches';

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
function AppContent() {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);

  // Initialize search state
  const [searchState, setSearchState] = useState({
    location: null,
    dates: {
      departure: null,
      return: null
    },
    matches: [],
    loading: false,
    error: null
  });

  const handleHomeClick = () => {
    navigate('/');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <HeaderNav />
      <Box component="main" sx={{ flexGrow: 1, backgroundColor: '#F7F7F7' }}>
        <Routes>
          <Route path="/" element={<Home searchState={searchState} setSearchState={setSearchState} />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile" element={user ? <Profile /> : <Auth />} />
          <Route path="/trips" element={user ? <Trips /> : <Auth />} />
          <Route path="/attended-matches" element={user ? <AttendedMatches /> : <Auth />} />
          <Route path="/preferences" element={user ? <Preferences /> : <Auth />} />
          <Route path="/stadiums" element={<Stadiums />} />
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
