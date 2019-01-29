const { BrowserBuilder } = require('@angular-devkit/build-angular');
const { mergeWebpack } = require("./merge");

/**
 * Custom webpack builder for browser.
 * It extends Angular's default BrowserBuilder by merging custom-webpack.config.js
 */
exports.default = class CustomWebpackBrowserBuilder extends BrowserBuilder {

  /**
   * Constructor.
   * @param context the build context
   */
  constructor(context) {
    super(context);
  }

  /**
   * Build webpack config.
   * @param root the project root
   * @param projectRoot the project root
   * @param host the build host
   * @param options the build options
   */
  buildWebpackConfig(root, projectRoot, host, options) {
    const browserConfig = super.buildWebpackConfig(root, projectRoot, host, options);
    return mergeWebpack(browserConfig);
  }
}
