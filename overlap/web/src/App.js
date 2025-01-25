import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Home from './components/Home';
import Matches from './components/Matches';

// Create a theme instance
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
      'Circular',
      '-apple-system',
      'BlinkMacSystemFont',
      'Roboto',
      'Helvetica Neue',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/matches" element={<Matches />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
