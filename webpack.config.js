import path from 'path';

export default {
  entry: './src/main.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve('.', 'dist'),
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  devServer: {
    static: './dist',
    hot: true,
    open: false,
    port: 3000
  }
};
