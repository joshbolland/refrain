module.exports = function (api) {
  api.cache(true);

  const isTest = process.env.NODE_ENV === 'test' || process.env.BABEL_ENV === 'test';

  const plugins = [];

  if (!isTest) {
    plugins.push('react-native-reanimated/plugin');
  }

  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins,
  };
};
