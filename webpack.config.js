const path = require('path');
const slsw = require('serverless-webpack');

module.exports = {
  mode: slsw.lib.webpack.isLocal ? 'development' : 'production',
  entry: slsw.lib.entries, // This comes from the Serverless Framework
  target: 'node',
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/, // All files ending in .ts
        loader: 'ts-loader', // Will be handled by 'ts-loader'
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'], // Look for .ts files first, then .js
  },
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js',
  },
};