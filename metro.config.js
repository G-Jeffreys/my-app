const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Firebase compatibility fixes for Expo - this fixes "Component auth has not been registered yet"
config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

// Apply NativeWind configuration and export
module.exports = withNativeWind(config, { input: "./global.css" }); 