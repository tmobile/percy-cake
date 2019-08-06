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

const path = require("path");
const {
  IndexHtmlWebpackPlugin
} = require("@angular-devkit/build-angular/src/angular-cli-files/plugins/index-html-webpack-plugin");

module.exports = {
  output: {
    filename:
      process.env.NODE_ENV === "test" ? "[name].js" : "[name].bundle.min.js"
  },
  resolve: {
    alias: {
      fs: "filesystem" // see src/app/filesystem
    }
  },
  module: {
    rules: [
      {
        test: /\.svg$/,
        loader: "raw-loader"
      },
      {
        test: /\.js$/,
        include: [
          // These dependency modules need be transpiled to es5 for older browser like IE11
          path.resolve(__dirname, "../../node_modules/universalify"),
          path.resolve(__dirname, "../../node_modules/fs-extra"),
          path.resolve(__dirname, "../../node_modules/filer"),
          path.resolve(__dirname, "../../node_modules/globrex"),
          path.resolve(__dirname, "../../node_modules/globalyzer"),
          path.resolve(__dirname, "../../node_modules/simple-get"),
          path.resolve(__dirname, "../../node_modules/isomorphic-git")
        ],
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            presets: ["env"],
            plugins: [
              [
                "transform-runtime",
                {
                  helpers: true,
                  polyfill: true,
                  regenerator: true
                }
              ]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new IndexHtmlWebpackPlugin({
      input: path.resolve(__dirname, "index.html"),
      entrypoints:
        process.env.NODE_ENV === "prod"
          ? ["percy"]
          : ["polyfills", "styles", "main", "scripts"]
    })
  ],
  optimization: {
    runtimeChunk: false // This will embed webpack runtime chunk in the single bundle
  },
  node: {
    process: true,
    path: true,
    buffer: true,
    Buffer: true
  }
};
