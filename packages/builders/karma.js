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

const { KarmaBuilder } = require("@angular-devkit/build-angular");
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
    const karmaConfig = super.buildWebpackConfig(
      root,
      projectRoot,
      sourceRoot,
      host,
      options
    );
    return mergeWebpack(karmaConfig);
  }
};
