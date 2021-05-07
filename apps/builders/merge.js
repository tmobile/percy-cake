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
 * Merge Angular's default webpack config with custom-webpack.config.js
 * @param defaultWebpackConfig Angular's default webpack config
 */
module.exports = function(defaultWebpackConfig) {
  // Use postcss-url to inline woff2 and svg files
  _.each(defaultWebpackConfig.module.rules, rule => {
    if (rule.loader === require.resolve('file-loader')) {
      // We'll use raw-loader for svg
      rule.test = /\.(eot|cur|jpg|png|webp|gif|otf|ttf|woff|woff2|ani)$/;
      return;
    }
    _.each(rule.use, usedLoader => {
      if (usedLoader.loader !== require.resolve('postcss-loader')) {
        return;
      }
      const pluginsCreator = _.get(usedLoader, "options.postcssOptions");
      if (pluginsCreator && typeof pluginsCreator === "function") {
        usedLoader.options.postcssOptions = loader => {
          const created = pluginsCreator(loader);
          // inline the woff2 fonts and svg images in css
          created.plugins.unshift(
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
          return created;
        };
      }
    });
  });

  // Merge webpack config
  const mergedConfig = webpackMerge.merge(defaultWebpackConfig, customWebpackConfig);

  return mergedConfig;
};
