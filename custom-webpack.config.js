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
  plugins: [
    new IndexHtmlWebpackPlugin({
      entrypoints: ['percy']
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
