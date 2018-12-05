const { getSystemPath } = require('@angular-devkit/core');
const { IndexHtmlWebpackPlugin } = require("@angular-devkit/build-angular/src/angular-cli-files/plugins/index-html-webpack-plugin")
const webpackMerge = require('webpack-merge');
const postcssUrl = require('postcss-url');
const { differenceWith, keyBy, merge, get, each } = require('lodash');

exports.mergeWebpack = function (root, baseWebpackConfig, options) {
  const customWebpackConfigPath = './custom-webpack.config.js';
  const customWebpackConfig = require(`${getSystemPath(root)}/${customWebpackConfigPath}`);

  each(baseWebpackConfig.module.rules, rule => {
    each(rule.use, usedLoader => {
      if (usedLoader.loader !== 'postcss-loader') {
        return;
      }
      const pluginsCreator = get(usedLoader, 'options.plugins');
      if (pluginsCreator && typeof pluginsCreator === 'function') {
        usedLoader.options.plugins = (loader) => {
          const plugins = pluginsCreator(loader);
          // inline the woff2 fonts and svg images in css
          plugins.unshift(postcssUrl(
            {
              filter: (asset) => {
                return asset.absolutePath.endsWith('.woff2') || asset.absolutePath.endsWith('.svg');
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

  const mergedConfig = webpackMerge.smartStrategy({})(baseWebpackConfig, customWebpackConfig);

  if (baseWebpackConfig.plugins && customWebpackConfig.plugins) {
    const conf1ExceptConf2 = differenceWith(baseWebpackConfig.plugins, customWebpackConfig.plugins, (item1, item2) => item1.constructor.name === item2.constructor.name);
    // const conf1ByName = keyBy(baseWebpackConfig.plugins, 'constructor.name');
    // customWebpackConfig.plugins = customWebpackConfig.plugins.map(p => conf1ByName[p.constructor.name] ? merge(conf1ByName[p.constructor.name], p) : p);
    mergedConfig.plugins = [...conf1ExceptConf2, ...customWebpackConfig.plugins];
  }

  if (process.env.NODE_ENV !== 'test') {
    // Combine polyfills, main and styles in a single bundle
    mergedConfig.entry = {
      percy: [
        './src/polyfills.ts',
        './src/styles.scss',
        './src/main.ts'
      ]
    }
    mergedConfig.output.filename = '[name].bundle.min.js';
    each(mergedConfig.plugins, (plugin, idx) => {
      if (plugin instanceof IndexHtmlWebpackPlugin) {
        mergedConfig.plugins[idx] = new IndexHtmlWebpackPlugin({
          entrypoints: ['percy']
        });
      }
    });
    mergedConfig.optimization.runtimeChunk = false; // This will embed webpack runtime chunk
  }

  // console.log(require('util').inspect(mergedConfig, false, 100, true))
  return mergedConfig;
}
