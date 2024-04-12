const {DefinePlugin} = require("webpack");

const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const dotenv = require('dotenv');
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env) => {

    const currentPath = path.join(__dirname);
    const basePath = currentPath + '/.env';
    const envPath = env ? basePath + '.' + env.NODE_ENV : '';
    const finalPath = fs.existsSync(envPath) ? envPath : basePath;
    const fileEnv = dotenv.config({path: finalPath}).parsed;
    const envKeys = {
        "process.env": JSON.stringify(fileEnv)
    };
    return {
        entry: './src/index.js',
        output: {
            filename: '[name].[contenthash].js',
            path: path.resolve(__dirname, 'dist'),
        },
        devServer: {
            contentBase: './dist',
        },
        plugins: [
            new DefinePlugin(envKeys),
            new CleanWebpackPlugin(),
            new HtmlWebpackPlugin({
                template: './src/template.html',
                  }),
            new CopyWebpackPlugin({
                patterns: [
                    {from: 'public/index.html'},
                ],
            }),
            
        ],
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        'style-loader',
                        'css-loader',
                    ],
                },
                {
                    test: /\.(png|svg|jpg|gif)$/,
                    use: [
                        'file-loader',
                    ],
                },
            ],
        }
    }
};
