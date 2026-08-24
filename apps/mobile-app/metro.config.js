const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo so Metro picks up shared package changes
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app's node_modules and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Map @shared-i18n/* scoped imports to the shared package source files
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@shared-i18n/types": path.resolve(monorepoRoot, "packages/shared-i18n/types"),
  "@shared-i18n/locales": path.resolve(monorepoRoot, "packages/shared-i18n/locales"),
  "@shared-i18n/dictionaries": path.resolve(monorepoRoot, "packages/shared-i18n/dictionaries"),
};

module.exports = config;
