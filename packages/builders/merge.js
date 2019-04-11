/**
=========================================================================
Copyright 2019 T-Mobile, USA

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
See the LICENSE file for additional language around disclaimer of warranties.

Trademark Disclaimer: Neither the name of “T-Mobile, USA” nor the names of
its contributors may be used to endorse or promote products derived from this
software without specific prior written permission.
=========================================================================== 
*/

const webpackMerge = require("webpack-merge");
const postcssUrl = require("postcss-url");
const _ = require("lodash");

const customWebpackConfig = require("./custom-webpack.config.js");

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
exports.mergeWebpack = function(defaultWebpackConfig) {
  // Use postcss-url to inline woff2 and svg files
  _.each(defaultWebpackConfig.module.rules, rule => {
    if (rule.loader === "file-loader") {
      // We'll use raw-loader for svg
      rule.test = /\.(eot|cur|jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/;
      return;
    }
    _.each(rule.use, usedLoader => {
      if (usedLoader.loader !== "postcss-loader") {
        return;
      }
      const pluginsCreator = _.get(usedLoader, "options.plugins");
      if (pluginsCreator && typeof pluginsCreator === "function") {
        usedLoader.options.plugins = loader => {
          const plugins = pluginsCreator(loader);
          // inline the woff2 fonts and svg images in css
          plugins.unshift(
            postcssUrl({
              filter: asset => {
                return (
                  asset.absolutePath.endsWith(".woff") ||
                  asset.absolutePath.endsWith(".woff2") ||
                  asset.absolutePath.endsWith(".svg")
                );
              },
              url: "inline",
              // NOTE: maxSize is in KB
              maxSize: 100,
              fallback: "rebase"
            })
          );
          return plugins;
        };
      }
    });
  });

  // Merge webpack config
  const mergedConfig = webpackMerge.smartStrategy({})(
    defaultWebpackConfig,
    customWebpackConfig
  );

  if (process.env.NODE_ENV === "prod" || process.env.NODE_ENV === "test") {
    // Combine polyfills, styles and main in a single bundle
    const entries = [];
    _.each(mergedConfig.entry, (entry, key) => {
      if (key !== "main") {
        pushEntires(entries, entry);
      }
    });
    // The main entry should be added as last one
    pushEntires(entries, mergedConfig.entry.main);

    if (process.env.NODE_ENV === "test") {
      mergedConfig.entry = { main: entries };
    } else {
      mergedConfig.entry = { percy: entries };
    }
  }

  return mergedConfig;
};
