// `module.exports` is equivilent to what will be reeturned from requiring()
// a module, in this case a function containing the definition of all the routes

// Note that requiring() the same package several times won't cause any overhead (cached)
const queryString = require('querystring');

module.exports = (fastify,functions,CONSTS) => 
{
    // Declare a handler for the favicon fetch
    fastify.get('/favicon.png', (req, res) => 
    {
        return res.sendFile("resc/favicon.png") 
    })

    //*** OAuth STEP 0 ***//
    fastify.get('/setstate', (req, res) =>
    // Set state cookie
    {
        // To be able to verify that the response we recieve from spotify is valid
        // we save a cookie with the client containing the state,
        // when the client responds we make sure that the storedState in the cookie
        // matches that of the state in the req to /callback
        let state = functions.stateString(CONSTS.STATE_STR_LENGTH);
        
        // Note that the interactions with `res` need to be chained togheter
        // We (seemingly) can't send a res with a Set-Cookie to the client and redirect at the same time
        // with fastify (possible with express) and therefore we redirect to a seperate route
        // were the redirection takes place after setting the cookie     
        res.setCookie( CONSTS.state_cookie_key, state, 
        {  
            domain: CONSTS.base_uri.replace(/^https?:\/\//,'').replace(new RegExp( ":" + CONSTS.WEB_SERVICE_PORT + "$" ), ''),
            path: '/',
            signed: true,
        })
        .redirect(CONSTS.base_uri + '/authorize')
    })
    
    //*** OAuth STEP 1 ***//
    fastify.get('/authorize', (req, res) =>
    // Redirect to accounts.spotify after setting the state cookie under /setstate
    {
        // Recall that the key-name for the state value isn't just 'state' 
        let state = eval(`req.cookies.${CONSTS.state_cookie_key}`) || null;

        if (state)
        {
            // We will need to include:
            //	* the `client_id` (of the app) so spotify knows what app the user is trying to use
            //	* the `redirect_uri` (/callback) which the user will be sent back to after successful authentication with spotfiy
            // 	* a random `state` string for security
            //	* a blankspace seperated list of scopes that the app will need to access
            // 	* `show_dialog` can be set to true (false is default) if the user should be prompted
            // 	to authorize the app anew every time they use it (set to true for testing)
            //  * `response_type`, set to 'code'

            // .stringify will produce a URL encoded string from a given JSON object
            res.redirect( CONSTS.auth_endpoint + 
                queryString.stringify( 
                {
                    client_id: CONSTS.client_id,
                    redirect_uri: CONSTS.redirect_uri,
                    state: state,
                    scope: CONSTS.scope ,
                    response_type: 'code',
                    show_dialog: false
                }
            ));
        }
        // if no state has been set redirect back to /setstate
        else { res.redirect('/setstate'); }
    })

    //*** OAuth STEP 2 ***//
    fastify.get('/callback', (req, res) =>
    // After sending the user to accounts.spotify they will be redirected back here
    {
        if ( req.query.error ) { functions.errorRedirect(res,req.query.error); }
        else
        {
            // If they accepted the req will contain:
            //	* code:  The authrization code generated by spotify which we can exchange for a token
            // 	* state: The same state value that we sent in the first req

            // Extract the req paramaters and cookie value (if they exist)
            let state = req.query.state || null;
            let code = req.query.code || null;

            // x = A ? A : B
            // Assign A to x if A evaluates to true otherwise use B
            let storedState = req.cookies ? req.cookies[CONSTS.state_cookie_key] : null;
            
            if ( storedState )
            {
                if ( state === storedState )
                {
                    if ( code )
                    // Provided that we have a matching state and a 'code' we will contact the /api/token
                    // endpoint to fetch a `refresh` and `access` token using a POST req
                    {
                        // At this point we can delete the auth cookie
                        res.clearCookie(CONSTS.state_cookie_key);
                        
                        // The POST req in OAuth2 should be of type: application/x-www-form-urlencoded
                        // * code: The 'code' recieved from the first step
                        // * redirect_uri: Not actually used for redirection, needs to match the paramater in step 1 
                        // * grant_type: Set to 'authorization_code'
                        // <header>
                        // * Authorization: base64() encoding of client_id and client_secret on the format
                        //   Authorization: Basic <base64 encoded client_id:client_secret>

                        // To encode using base64 we allocate a buffer object
                        let auth_header = functions.getAuthHeader();

                        let postOptions = 
                        {
                            url: CONSTS.token_endpoint,
                            form: 
                            {
                                code: code,
                                redirect_uri: CONSTS.redirect_uri,
                                grant_type: 'authorization_code'
                            },
                            headers: 
                            { 
                                'Authorization': 'Basic ' + auth_header,
                                'Content-Type': 'application/x-www-form-urlencoded'  
                            },
                            json: true
                        }

                        // We use a seperate module to send out our own request
                        functions.tokenRequest(res,postOptions);
                    }
                    else { functions.errorRedirect(res,"Missing code in request"); }
                }
                else { functions.errorRedirect(res,"State mismatch"); }
            }
            else { functions.errorRedirect(res,"No stored state in cookies!"); }
        }
    })
    
    //**** OAuth STEP 3 *****/
    fastify.get('/home', (req, res) => 
    {
        // Use the URL parameters passed from STEP 2 
        // for access_token, refresh_token and expires_in on the client side
        // to make requests to the web API
        
        res.view('/templates/index.ejs', { title: "/home" })
    })
    
    //**** OAuth STEP 4 *****/
    fastify.get('/refresh', (req, res) => 
    {
        // When the acces_token expires the client will contact this end-point to
        // recieve a new one using the same method as in /callback but with the 'code' set to
        // the supplied refresh_token
        if ( req.query.refresh_token )
        {
            // Create the auth header in the same way as for /callback
            let auth_header = functions.getAuthHeader();

            // POST options are the same aside from the 'grant_type', 'refresh_token' and 'code' keys
            // The 'code' is supplied from Spotify when the user authorizies themselves and sent
            // along to the /callback, in the /refresh scenario the user does not contact Spotify 
            // and thereby does not have a 'code' (and the parameter is therefore skipped)
            let postOptions = 
            {
                url: CONSTS.token_endpoint,
                form: 
                {
                    refresh_token: req.query.refresh_token,
                    redirect_uri: CONSTS.redirect_uri,
                    grant_type: 'refresh_token'
                },
                headers: 
                { 
                    'Authorization': 'Basic ' + auth_header,
                    'Content-Type': 'application/x-www-form-urlencoded'  
                },
                json: true
            }                

            functions.tokenRequest(res, postOptions, refresh=true);
        }
        else 
        { 
            res.send("refresh_token missing from request");
        }
    })

    fastify.get('/error', (req, res) => 
    {
        // The .view object is supplied by point-of-view and is used
        // to parse inputs to the template engine
        let err = req.query['error'] || "Unknown error" ;
        res.view('/templates/error.ejs', { error: err.charAt(0).toUpperCase() + err.slice(1,) })
    })
    
    fastify.get('/', (req, res) => 
    {
        // Static file serving
        //res.sendFile("index.html") 
        res.view('/templates/index.ejs', { title: "/" })
    })

}


