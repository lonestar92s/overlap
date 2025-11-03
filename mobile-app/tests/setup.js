// Jest setup file for React Native tests
import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const storage = {};
  return {
    getItem: jest.fn((key) => Promise.resolve(storage[key] || null)),
    setItem: jest.fn((key, value) => Promise.resolve(storage[key] = value)),
    removeItem: jest.fn((key) => Promise.resolve(delete storage[key])),
    clear: jest.fn(() => Promise.resolve(Object.keys(storage).forEach(key => delete storage[key]))),
    getAllKeys: jest.fn(() => Promise.resolve(Object.keys(storage))),
    multiGet: jest.fn((keys) => Promise.resolve(keys.map(key => [key, storage[key] || null]))),
    multiSet: jest.fn((items) => Promise.resolve(items.forEach(([key, value]) => storage[key] = value))),
  };
});

// Mock expo modules
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({
    coords: { latitude: 37.7749, longitude: -122.4194 }
  })),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ cancelled: false, uri: 'file://test.jpg' })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ cancelled: false, uri: 'file://test.jpg' })),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

// Mock Mapbox
jest.mock('@rnmapbox/maps', () => ({
  MapView: 'MapView',
  Camera: 'Camera',
  PointAnnotation: 'PointAnnotation',
  ShapeSource: 'ShapeSource',
  SymbolLayer: 'SymbolLayer',
  CircleLayer: 'CircleLayer',
  LineLayer: 'LineLayer',
  setAccessToken: jest.fn(),
}));

// Mock react-native-maps
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props, ref) => <View {...props} ref={ref} testID="mock-map" />),
    Marker: (props) => <View {...props} testID="mock-marker" />,
    PROVIDER_GOOGLE: 'google',
    PROVIDER_DEFAULT: 'default',
  };
});

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Silence console warnings in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);

