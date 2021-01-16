#!/usr/bin/env node
const SERVER = "lofy";
const PORT = 3443;

//******** ASYNC SETUP **********/
// To wait for the readFile() operation to complete we start
// the app in an async function. To make it so that `fs.` functions return
// awaitable promises we import the module as:
const fs = require("fs");

const runAsync = async () => 
{ 
	//******* CONSTANTS ************/
	const CONFIG = 
	{
		WEB_SERVICE_PORT: PORT,
		WEB_SERVICE_ADDR: '0.0.0.0',
		STATE_STR_LENGTH: 16,
		DIR_ROOT: 'public',

		// Fix invaid client-redirect on dev.spotify
		token_endpoint: 'https://accounts.spotify.com/api/token',
		auth_endpoint: 'https://accounts.spotify.com/authorize?',
		base_uri: `https://${SERVER}:${PORT}`,
		redirect_uri: `https://${SERVER}:${PORT}/callback`,

		// Authorizations required by the app
		// https://developer.spotify.com/documentation/general/guides/scopes/
		scope: 'playlist-read-private streaming user-read-private user-read-email user-modify-playback-state user-read-playback-state user-read-currently-playing',
		state_cookie_key: 'spotify_auth_state',

		client_id: 	   await fs.promises.readFile("./secret/client_id", 'utf-8'), 
		client_secret: await fs.promises.readFile("./secret/client_secret", 'utf-8'),
		
		tls_key: 	   await fs.promises.readFile("./secret/server.key", 'utf-8'),
		tls_cert: 	   await fs.promises.readFile("./secret/server.crt", 'utf-8'),

		local_playlists_dir: "./playlists"
	}

	//*************************************/

	const path = require("path");

	// Import the functions neccessary into the functions object (passing along the constants)
	// Some external modules like queryString are also imported from here
	const functions = require('./serverFunctions')(CONFIG);

	//********* FASTIFY SETUP ************/

	// Fastify is an alternative to express, with fastify-static being
	// requiried to serve static files, i.e. access to reply.sendFile()
	const fastify = require('fastify')(
		{ 
			logger: true,
			https: {
				key: CONFIG.tls_key,
				cert: CONFIG.tls_cert
			}
		});

	const fastify_static = require('fastify-static');
	
	// Set the static content directory root
	// The register method allows the user to extend functionality with plugins. 
	// A plugin can be a set of routes, a server decorator etc. in this case 
	// it provides static file serving
	fastify.register( fastify_static,
	{
		root: path.join(__dirname, CONFIG.DIR_ROOT),
		prefix: '/',
	})

	// Register the CORS (Cross-origin resource sharing) plugin
	// Adding a hook for all replies to add the 'Access-Control-Allow-Origin' header allowing XHR requests
	// to api.spotify.com from the client. Recall that 'Origin' is set in REQUESTS not, replies
	fastify.register(require('fastify-cors'), { origin: "api.spotify.com"});

	// TEMPLATE ENGINE
	// Plugin for template engine (i.e. dynamic HTML) compatiblity with fastify
	fastify.register(require('point-of-view'), 
	{
		engine: 
		{
			// The template engine used (EJS = Embedded JavaScript)
			ejs: require('ejs')
		}
	})

	// COOKIE support
	// This plugin gives us access to reply.setCookie() and request.cookies
	fastify.register(require('fastify-cookie'), {
		secret: functions.stateString(CONFIG.STATE_STR_LENGTH), 
		parseOptions: {} 
	})

	// SESSION support (depends on the cookie plugin)
	// The `secure` option needs to be set to false for plain HTTP
	//fastify.register(require('fastify-session'), 
	//{
	//	secret: functions.stateString(32),
	//	options: {secure: false} 
	//});	

	//************************************/

	// Setup the routes and error handlers
	require("./routes")(fastify,functions,CONFIG);
	require("./errorHandlers")(fastify);

	// Start the server
	require("./server")(fastify,CONFIG);
}

runAsync();


