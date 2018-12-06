const { BrowserBuilder } = require('@angular-devkit/build-angular');
const { mergeWebpack } = require("./merge");

class CustomWebpackBrowserBuilder extends BrowserBuilder {

  constructor(context) {
    super(context);
  }

  buildWebpackConfig(root, projectRoot, host, options) {
    const browserWebpackConfig = super.buildWebpackConfig(root, projectRoot, host, options);
    return mergeWebpack(root, browserWebpackConfig, options);
  }
}

exports.default = CustomWebpackBrowserBuilder;
