module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 3 worklet transform — must be the last plugin.
    plugins: ['react-native-reanimated/plugin'],
  };
};
