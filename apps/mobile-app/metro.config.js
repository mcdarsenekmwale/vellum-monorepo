const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.projectRoot = projectRoot;
config.watchFolders = [
  ...(config.watchFolders || []),
  monorepoRoot,
];

config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths || []),
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "@shared-i18n/types": path.resolve(monorepoRoot, "packages/shared-i18n/types"),
  "@shared-i18n/locales": path.resolve(monorepoRoot, "packages/shared-i18n/locales"),
  "@shared-i18n/dictionaries": path.resolve(monorepoRoot, "packages/shared-i18n/dictionaries"),
};

module.exports = config;
