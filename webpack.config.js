const webpack = require ("webpack");
const path = require ("path");

module.exports = {
	cache: true,
	devtool: "eval",
	entry: {
		all: ["babel-polyfill", "./www/client/extjs4/all-debug.js"]
	},
	output: {
		path: path.resolve ("./www/client/extjs4"),
		publicPath: "/",
		filename: "[name].js"
	},
	plugins: [
		new webpack.DefinePlugin ({
			"process.env": {
				NODE_ENV: JSON.stringify ("production")
			}
		})
	],
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: [
					"node_modules",
				],
				use: [
					{
						loader: "babel-loader",
						query: {
							cacheDirectory: true,
						}
					}
				]
			}
		]
	}
};
