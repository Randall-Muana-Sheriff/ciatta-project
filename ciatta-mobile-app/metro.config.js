// Expo's Metro defaults, plus one asset type: the provider directory
// (assets/providers/epic-brands.dir), carried as a file and read at run
// time rather than compiled into the JavaScript bundle, where six
// megabytes of text would slow every launch.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('dir');

module.exports = config;
