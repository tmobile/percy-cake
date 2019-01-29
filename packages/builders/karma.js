const { KarmaBuilder } = require('@angular-devkit/build-angular');
const { mergeWebpack } = require("./merge");

/**
 * Custom webpack builder for Karma test.
 * It extends Angular's default KarmaBuilder by merging custom-webpack.config.js
 */
exports.default = class CustomWebpackKarmaBuilder extends KarmaBuilder {

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
   * @param sourceRoot the source root
   * @param host the build host
   * @param options the build options
   */
  buildWebpackConfig(root, projectRoot, sourceRoot, host, options) {
    const karmaConfig = super.buildWebpackConfig(root, projectRoot, sourceRoot, host, options);
    return mergeWebpack(karmaConfig);
  }
}
