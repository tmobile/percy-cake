/**
 *    Copyright 2019 T-Mobile
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

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
