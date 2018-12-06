const { KarmaBuilder } = require('@angular-devkit/build-angular');
const { mergeWebpack } = require("./merge");

class CustomWebpackKarmaBuilder extends KarmaBuilder {

  constructor(context) {
    super(context);
  }

  buildWebpackConfig(root, projectRoot, sourceRoot, host, options) {
    const karmaConfig = super.buildWebpackConfig(root, projectRoot, sourceRoot, host, options);
    return mergeWebpack(root, karmaConfig, options);
  }
}

exports.default = CustomWebpackKarmaBuilder;
