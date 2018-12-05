const { ServerBuilder } = require('@angular-devkit/build-angular');
const { mergeWebpack } = require("./merge");

class CustomWebpackServerBuilder extends ServerBuilder {

  constructor(context) {
    super(context);
  }

  buildWebpackConfig(root,
    projectRoot,
    host,
    options) {
    const serverWebpackConfig = super.buildWebpackConfig(root, projectRoot, host, options);
    return mergeWebpack(root, serverWebpackConfig, options);
  }
}

exports.default = CustomWebpackServerBuilder;
