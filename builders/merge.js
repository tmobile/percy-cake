const webpackMerge = require('webpack-merge');
const postcssUrl = require('postcss-url');
const _ = require('lodash');

const customWebpackConfig = require('../custom-webpack.config.js');

/**
 * Push entry.
 * @param entries array of entries to push into
 * @param entry the entry to push to array array
 */
function pushEntires(entries, entry) {
  if (_.isArray(entry)) {
    entries.push(...entry);
  } else {
    entries.push(entry);
  }
}

/**
 * Merge Angular's default webpack config with custom-webpack.config.js
 * @param defaultWebpackConfig Angular's default webpack config
 */
exports.mergeWebpack = function (defaultWebpackConfig) {
  // Use postcss-url to inline woff2 and svg files
  _.each(defaultWebpackConfig.module.rules, rule => {
    _.each(rule.use, usedLoader => {
      if (usedLoader.loader !== 'postcss-loader') {
        return;
      }
      const pluginsCreator = _.get(usedLoader, 'options.plugins');
      if (pluginsCreator && typeof pluginsCreator === 'function') {
        usedLoader.options.plugins = (loader) => {
          const plugins = pluginsCreator(loader);
          // inline the woff2 fonts and svg images in css
          plugins.unshift(postcssUrl(
            {
              filter: (asset) => {
                return asset.absolutePath.endsWith('.woff') || asset.absolutePath.endsWith('.woff2') || asset.absolutePath.endsWith('.svg');
              },
              url: 'inline',
              // NOTE: maxSize is in KB
              maxSize: 100,
              fallback: 'rebase',
            }
          ));
          return plugins;
        }
      }
    });
  });

  // Merge webpack config
  const mergedConfig = webpackMerge.smartStrategy({})(defaultWebpackConfig, customWebpackConfig);

  // Combine polyfills, styles and main in a single bundle
  const entries = [];
  _.each(mergedConfig.entry, (entry, key) => {
    if (key !== 'main') {
      pushEntires(entries, entry);
    }
  });
  // The main entry should be added as last one
  pushEntires(entries, mergedConfig.entry.main);

  if (process.env.NODE_ENV === 'test') {
    mergedConfig.entry = { main: entries };
  } else {
    mergedConfig.entry = { percy: entries };
  }

  return mergedConfig;
}
