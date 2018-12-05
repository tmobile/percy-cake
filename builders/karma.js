const { KarmaBuilder } = require('@angular-devkit/build-angular');
const { mergeWebpack } = require("./merge");

class CustomWebpackKarmaBuilder extends KarmaBuilder {

  constructor(context) {
    super(context);
    super['_buildWebpackConfig'] = this.buildWebpackConfig;
  }

  buildWebpackConfig(root,
    projectRoot,
    sourceRoot,
    host,
    options) {
    const karmaConfig = KarmaBuilder.prototype['_buildWebpackConfig'].call(this, root, projectRoot, sourceRoot, host, options);
    return mergeWebpack(root, karmaConfig, options);
  }
}

exports.default = CustomWebpackKarmaBuilder;
