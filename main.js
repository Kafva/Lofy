#!/usr/bin/env node

//********* DEBUGGING **********/
//		tshark -i en0 -Y "http.request || http.response" tcp port 443 or 80
//		curl http://localhost:3443/callback?state=333&code=deadbeef
//		Object.keys() ~ dir()
//******************************/

//******** ASYNC SETUP **********/
// To wait for the readFile() operation to complete we start
// the app in an async function

const fs = require('fs');
const util = require('util');
const path = require('path');

// Make readFile return a promise and create an async function returning the promise
// readAsync() can then be awaited inside runAsync()
const readFile = util.promisify(fs.readFile);
const readAsync = async (name) => readFile(name,'utf8') ;

const runAsync = async () => 
{ 
	//******* CONSTANTS ************/
	const CONSTS = 
	{
		WEB_SERVICE_PORT: 3443,
		STATE_STR_LENGTH: 16,
		DIR_ROOT: 'public',

		auth_endpoint: 'https://accounts.spotify.com/authorize?',
		base_uri: 'http://localhost:3443',
		redirect_uri: `http://localhost:3443/callback`,

		// Authorizations required by the app
		// https://developer.spotify.com/documentation/general/guides/scopes/
		scope: 'playlist-read-private streaming',
		state_cookie_key: 'spotify_auth_state',

		client_id: await readAsync("./secret/client_id") 
	}

	//*************************************/

	// Import the functions neccessary into the functions object (passing along the constants)
	// Some external modules like queryString are also imported from here
	const functions = require('./serverFunctions')(CONSTS);

	//********* FASTIFY SETUP ************/

	// Fastify is an alternative to express, with fastify-static being
	// requiried to serve static files, i.e. access to reply.sendFile()
	const fastify = require('fastify')({ logger: true });
	const fastify_static = require('fastify-static');

	// Set the static content directory root
	// The register method allows the user to extend functionality with plugins. 
	// A plugin can be a set of routes, a server decorator etc. in this case 
	// it provides static file serving
	fastify.register( fastify_static,
	{
		root: path.join(__dirname, CONSTS.DIR_ROOT),
		prefix: '/',
	})

	// Register the CORS (Cross-origin resource sharing) plugin
	// When issuing a request in JS from a page the HTTP headers 'Origin:'
	// is accepted by default (Same origin requests)

	// To send requests to other sites we need to explicitly enable these with the
	// 'Access-Control-Allow-Origin:' field(s) in our HTTP messages  (can be set to wildcard).
	fastify.register(require('fastify-cors'), { origin: "*" })

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
	// This plugin gives us access to reply.cookies and request.cookies
	fastify.register(require('fastify-cookie'), {
		secret: functions.stateString(CONSTS.STATE_STR_LENGTH), 
		parseOptions: {} 
	})

	//************************************/

	// Setup the routes
	require("./routes")(fastify,functions,CONSTS);

	// Start the server
	require("./server")(fastify,CONSTS);
}

runAsync();


