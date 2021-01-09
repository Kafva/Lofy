// Functions in `module.exports` will be available inside the required() object that is imported in server.js
// Since we assign a function to module.exports in this case we need to RETURN a dictionary
// of the functions we define 

const { orderTags } = require("music-metadata/lib/core");
const queryString = require('querystring');
const request = require('request');

const mm = require('music-metadata');

// NOTE that some `fs.` functions like `createReadStream` lack an async equivelent, it is therefore
// preferable to import the plain `fs` module and use `fs.promises` explicitly
//const { promises: fs.promises } = require("fs");
const fs = require('fs');

// Promisify exec()
const util = require('util');
const { send } = require("process");
const exec = util.promisify(require('child_process').exec);

module.exports = (CONSTS) => 
{
    //***** Unexported ******//

    const setCookie = (res, key, value) =>
    {
        res.setCookie( key, value, 
        {  
            domain: CONSTS.base_uri.replace(/^https?:\/\//,'').replace(new RegExp( ":" + CONSTS.WEB_SERVICE_PORT + "$" ), ''),
            path: '/',
            signed: false,
        })
    }
    
    const getLineCount = async (filePath) => 
    // Get line count via `wc`
    {
        const { stdout } = await exec(`cat ${filePath} | wc -l`);
        return parseInt(stdout);
    };
    
    const getMusicMeta = async (filePath) => 
    {
        try  { return await mm.parseFile(filePath); } 
        catch (err) { return; }
    };
    
    //**** Exported ****//

    const getTokenParams = (body, refresh) =>
    {
        if ( body.access_token !== undefined && body.expires_in !== undefined && body.refresh_token !== undefined )
        {
            return {
                access_token: body.access_token,
                refresh_token: body.refresh_token,
                expires_in: body.expires_in
            };  
        }
        else if ( body.access_token !== undefined && body.expires_in !== undefined && refresh )
        // NOTE that when using the refresh_token to gain a new access_token the response could
        // lack a new refresh_token
        {
            return {
                access_token: body.access_token,
                expires_in: body.expires_in
            };  
        }
        else { return false; }
    }
    
    const errorRedirect = (reply,msg, refresh=false) =>
    {
        // We do not want to redirect when raising errors on the /refresh route
        if (refresh) { reply.send(msg) }
        else
        {
            reply.redirect( `${CONSTS.base_uri}/error?` + queryString.stringify( {error: msg })  ); 
        }
    }

    const stateString = (length) =>
    // Produce an alphanumeric random string
    {
        let bases = [ 48, 65, 97 ];
        let cnts  = [ 9, 25, 25  ];
        let index = -1; let str = "";

        for (let i=0; i<length; i++)
        {
            // If we multiply by 3 there is a minimal chance that we get a index out of bounds
            index = Math.floor(Math.random() * 2.9999999);
            str += String.fromCharCode( Math.floor(Math.random()*cnts[index] + bases[index]) );
        }
        
        return str;
    }

    const getAuthHeader = () =>
    {
        // <header>
        // * Authorization: base64() encoding of client_id and client_secret on the format
        //   Authorization: Basic <base64 encoded client_id:client_secret>

        // To encode using base64 we allocate a buffer object
        return new Buffer.alloc( 
            CONSTS.client_id.length+CONSTS.client_secret.length+1,
            CONSTS.client_id + ':' + CONSTS.client_secret)
        .toString('base64');
    }

    const tokenRequest = (res, postOptions, refresh=false) =>
    {
        // We use a seperate module to send out our own request
        request.post( postOptions, (error, response, body) => 
        {
            if (!error && response.statusCode === 200)
            {
                // A non-error response will contain JSON data in the message body:
                // * access_token: The access_token to be used in subsequent calls to the Spotify API
                // * token_type: Set to 'Bearer'
                // * scope: The blankspace seperated list of scopes that the token is valid for
                // * expires_in: (seconds)
                // * refresh_token: This token can be used when the access_token expires to get a new
                // access_token (and refresh_token) by sending a message to /api/token with the 'code'
                // set to the value of the refresh_token. The response will be on the same format as here
                
                // With this we can pass the access_token to the client and let them issue
                // requests to the Spotify web API. 

                if ( (params = getTokenParams(body, refresh)) !== false )
                {
                    if (refresh) { res.send(params); }
                    else
                    { 
                        // NOTE that using the URL parameters to pass the access_token etc. is not that bad
                        // provided that HTTPS is being used, the GET parameters are stored in the HTTP payload
                        // and are thus encrypted until they reach the destination.
                        // HOWEVER, server logs will of course store the access URLs in plain-text, because of this
                        // it could be considered slightly safer to use Set-Cookie to pass parameters since
                        // most server logs won't include the complete list of HTTP headers in their logs

                        // It is informally allowed to specify several cookies in the same 'Set-Cookie'
                        // header but it is preferable to use a seperate entry for each one
                        setCookie(res,'access_token', params.access_token);
                        setCookie(res,'refresh_token', params.refresh_token);
                        setCookie(res,'expires_in', params.expires_in.toString() );
                        
                        res.redirect('/home');
                    }
                }
                else { errorRedirect(res, `Missing component(s) of response: ${params}`, refresh); }
            }
            else { errorRedirect(res, error || body.error, refresh); }
        });

    }
    
    const getLocalPlaylists = async () =>
    // Returns a list of JSON objects describing each playlist, each playlist will contain a list of the
    // tracks within the playlist
    {
        local_playlists = [];
        
        for (let playlist of await fs.promises.readdir(CONSTS.local_playlists_dir))
        {
            // Extract each line (with the path to a sound file) from each playlist file 
            let tracks = (await fs.promises.readFile(`${CONSTS.local_playlists_dir}/${playlist}`, 'utf-8')).toString().split('\n');

            let tracks_meta = [];
            
            // The track_id corresponds to the line in the playlist file
            let track_id = 1;

            for (let track of tracks)
            {
                // Extract metadata from each track
                if (track.length == 0) continue
                let metadata = await getMusicMeta(track);
                
                if ( metadata != null && metadata != undefined )
                {
                    tracks_meta.push(
                        {
                            id: track_id,
                            title: metadata.common.title || "Unknown",
                            artist: metadata.common.artist || "Unknown",
                            album: metadata.common.album || "Unknown",
                            duraion: metadata.format.duration || 0
                        }
                    );
                }
                else { console.error(`getLocalPlaylists(): Can't parse metadata for ${track}`); }

                // Incrment the track_id
                track_id++;
            }

            local_playlists.push( 
                { 
                    name: playlist.split(".")[0],
                    tracks: tracks_meta,
                    count: tracks.length
                }
            );
        }

        return local_playlists;
    }

    const getTrackAudio = async (req, res) =>
    {
        // req.params       ==> { playlist: <...>, trackNum: <...> }
        // local_playlists  ==> [ { 
        //     name: <...>, 
        //     count: <...> 
        //     tracks: [
        //         {
        //             id: <...>,
        //             title: <...>,
        //             duration: <...>
        //         }
        //     ]}, ... 
        // ]
       
        
        //**************************************************************/
        const stream = fs.createReadStream("/Users/jonas/Dropped/Music/Lain/Family Portrait-572937954.mp3");
        return res.type('audio/mpeg').send(stream);
        //**************************************************************/

        
        //local_playlists = await getLocalPlaylists();
        
        //if ( local_playlists.some( p => p.name == req.params.playlist ) )
        //{
        //    track_count = await getLineCount( `${CONSTS.local_playlists_dir}/${req.params.playlist}.txt` );

        //    if ( parseInt(req.params.trackNum) <= track_count )
        //    {
        //        // TODO Determine the content-type of the perticular track

        //                                
        //        // Create a pipe to the sound file on the server
        //        // https://stackoverflow.com/questions/35549581/express-node-angular-sending-audio-file-to-front-end
        //        // which the client can access

        //        //let f = await fs.promises.readFile('./public/resc/test.mp3','binary');
        //        //res.type("application/octet-stream");
        //        //res.send(f);
        //    }
        //    else { errorRedirect(res, `'${req.params.playlist}' only has ${track_count} tracks`,refresh=true); }
        //}
        //else { errorRedirect(res, `No such playlist: ${req.params.playlist}`,refresh=true); }

    }

    return { getTokenParams, errorRedirect, stateString, getAuthHeader, tokenRequest, getLocalPlaylists, getTrackAudio };
};
