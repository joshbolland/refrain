// Learn more: https://docs.expo.dev/guides/metro-config/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('cjs');

const safeAreaShim = path.resolve(__dirname, 'metro', 'SafeAreaViewShim.js');
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react-native/Libraries/Components/SafeAreaView/SafeAreaView' ||
    moduleName === 'react-native/src/private/specs_DEPRECATED/components/RCTSafeAreaViewNativeComponent'
  ) {
    return { type: 'sourceFile', filePath: safeAreaShim };
  }

  if (typeof originalResolveRequest === 'function') {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
