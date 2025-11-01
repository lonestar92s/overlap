// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver to stub react-dom for React Native
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    'react-dom': path.resolve(__dirname, 'react-dom-stub.js'),
  },
};

module.exports = config;

