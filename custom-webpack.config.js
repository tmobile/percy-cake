const path = require('path');
const { IndexHtmlWebpackPlugin } = require("@angular-devkit/build-angular/src/angular-cli-files/plugins/index-html-webpack-plugin")

module.exports = {
  output: {
    filename: process.env.NODE_ENV === 'test' ? '[name].js' : '[name].bundle.min.js'
  },
  resolve: {
    alias: {
      'fs': 'filesystem', // see src/app/filesystem
    }
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        include: [
          // These dependency modules need be transpiled to es5 for older browser like IE11
          path.resolve(__dirname, "node_modules/universalify"),
          path.resolve(__dirname, "node_modules/fs-extra"),
          path.resolve(__dirname, "node_modules/filer"),
          path.resolve(__dirname, "node_modules/globrex"),
          path.resolve(__dirname, "node_modules/globalyzer"),
          path.resolve(__dirname, "node_modules/simple-get"),
          path.resolve(__dirname, "node_modules/isomorphic-git"),
        ],
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false,
            presets: ['env'],
            plugins: [
              ["transform-runtime", {
                "helpers": true,
                "polyfill": true,
                "regenerator": true,
              }]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new IndexHtmlWebpackPlugin({
      entrypoints: process.env.NODE_ENV === 'prod' ? ['percy'] : ['polyfills', 'styles', 'main']
    }),
  ],
  optimization: {
    runtimeChunk: false // This will embed webpack runtime chunk in the single bundle
  },
  node: {
    process: true,
    path: true,
    buffer: true,
    Buffer: true,
  }
};
