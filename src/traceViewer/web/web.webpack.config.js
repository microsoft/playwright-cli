const path = require('path');
const HtmlWebPackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: {
    app: path.join(__dirname, 'index.tsx'),
    'monaco.editor.worker': 'monaco-editor/esm/vs/editor/editor.worker.js',
    'monaco.json.worker': 'monaco-editor/esm/vs/language/json/json.worker',
    'monaco.css.worker': 'monaco-editor/esm/vs/language/css/css.worker',
    'monaco.html.worker': 'monaco-editor/esm/vs/language/html/html.worker',
    'monaco.ts.worker': 'monaco-editor/esm/vs/language/typescript/ts.worker',
  },
  resolve: {
    extensions: ['.ts', '.js', '.tsx', '.jsx']
  },
  output: {
    globalObject: 'self',
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '../../../out/web')
  },
  module: {
    rules: [
      {
        test: /\.(j|t)sx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.ttf$/,
        use: ['file-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebPackPlugin({
      title: 'Playwright Trace Viewer',
      template: path.join(__dirname, 'index.html'),
    })
  ]
};
