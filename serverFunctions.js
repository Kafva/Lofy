// Functions in `module.exports` will be available inside the required() object that is imported in server.js
// Since we assign a function to module.exports in this case we need to RETURN a dictionary
// of the functions we define 

const { orderTags } = require("music-metadata/lib/core");
const queryString = require('querystring');
const request = require('request');
const mm = require('music-metadata');
const sizeOf = require('buffer-image-size');

// NOTE that some `fs.` functions like `createReadStream` lack an async equivelent, it is therefore
// preferable to import the plain `fs` module and use `fs.promises` explicitly
//const { promises: fs.promises } = require("fs");
const fs = require('fs');

// Promisify exec()
const util = require('util');
const { send } = require("process");
const exec = util.promisify(require('child_process').exec);

module.exports = (CONFIG) => 
{
    //***** Unexported ******//

    const setCookie = (res, key, value) =>
    {
        res.setCookie( key, value, 
        {  
            domain: CONFIG.base_uri.replace(/^https?:\/\//,'').replace(new RegExp( ":" + CONFIG.WEB_SERVICE_PORT + "$" ), ''),
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

    const getTokenParams = (body, textOnly) =>
    {
        if ( body.access_token !== undefined && body.expires_in !== undefined && body.refresh_token !== undefined )
        {
            return {
                access_token: body.access_token,
                refresh_token: body.refresh_token,
                expires_in: body.expires_in
            };  
        }
        else if ( body.access_token !== undefined && body.expires_in !== undefined && textOnly )
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
    
    const errorRedirect = (reply,msg, textOnly=false) =>
    {
        // We do not want to redirect when raising errors on the /refresh route
        if (textOnly) { reply.send(msg) }
        else
        {
            reply.redirect( `${CONFIG.base_uri}/error?` + queryString.stringify( {error: msg })  ); 
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
            index = Math.floor(Math.random() * 3);
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
            CONFIG.client_id.length+CONFIG.client_secret.length+1,
            CONFIG.client_id + ':' + CONFIG.client_secret)
        .toString('base64');
    }

    const tokenRequest = (res, postOptions, textOnly=false) =>
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

                if ( (params = getTokenParams(body, textOnly)) !== false )
                {
                    if (textOnly) { res.send(params); }
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
                        
                        // The ?redirect paramater is used to notify the server that the client
                        // has passed the OAuth process
                        res.redirect('/home?redirect=true');
                    }
                }
                else { errorRedirect(res, `Missing component(s) of response: ${params}`, textOnly); }
            }
            else { errorRedirect(res, error || body.error, textOnly); }
        });

    }
    
    const getLocalPlaylists = async () =>
    // Returns a list of JSON objects describing each playlist, each playlist will contain a list of the
    // tracks within the playlist
    {
        local_playlists = [];
        
        for (let playlist of await fs.promises.readdir(CONFIG.local_playlists_dir))
        {
            // Extract each line (with the path to a sound file) from each playlist file 
            let tracks = (await fs.promises.readFile(`${CONFIG.local_playlists_dir}/${playlist}`, 'utf-8')).toString().split('\n');
            
            // Pop the last empty line
            tracks.pop();

            let tracks_meta = [];
            
            // The track_id corresponds to the line in the playlist file and starts from 1
            let track_id = 1;

            for (let track of tracks)
            {
                if (track.length == 0)
                {
                    console.error(`============= TODO ================\nSkipping metadata fetch for ${playlist}`, track);
                    continue
                }
                
                // Extract metadata from each track
                metadata = await getMusicMeta(track);
                cover = {};
                
                if ( metadata != null && metadata != undefined )
                {
                    if (metadata.common.picture != undefined)
                    {
                        cover = sizeOf( metadata.common.picture[0].data );
                    }

                    tracks_meta.push(
                        {
                            id: track_id,
                            title: metadata.common.title || "Unknown",
                            artist: metadata.common.artist || "Unknown",
                            album: metadata.common.album || "Unknown",
                            duration: metadata.format.duration || 0,
                            cover: cover
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
    
    const getTrackData = async (req, res, cover=false) =>
    {
        // req.params       ==> { playlist: <...>, trackNum: <...> }
        // local_playlists  ==> [ { 
        //     name: <...>, 
        //     count: <...> 
        //     tracks: [
        //         {
        //             id: <...>,
        //             title: <...>,
        //             artist: <...>,
        //             album: <...>,
        //             duration: <...>
        //             cover:
        //             {
        //               width: <...>
        //               height: <...>
        //               type: <...>    
        //             }
        //         }
        //     ]}, ... 
        // ]
       
        local_playlists = await getLocalPlaylists();
        
        if ( local_playlists.some( p => p.name == req.params.playlist ) )
        {
            track_count = await getLineCount( `${CONFIG.local_playlists_dir}/${req.params.playlist}.txt` );

            if ( parseInt(req.params.trackNum) <= track_count )
            {
                // Fetch the .trackNum line from the playlist text file with the path to the sound file
                let tracks = (await fs.promises.readFile(`${CONFIG.local_playlists_dir}/${req.params.playlist}.txt`, 'utf-8')).toString().split('\n');

                try
                {
                    stream = fs.createReadStream( tracks[ req.params.trackNum - 1 ] );
                }
                catch (e) { console.error(`getTrackAudio(): Can't find ${tracks[ req.params.trackNum - 1 ]}`); }
                
                // Determine the Content-type of the sound file
                metadata = await getMusicMeta(  tracks[ req.params.trackNum - 1 ] );
                if (cover)
                {
                    if ( metadata.common.picture != undefined )
                    {
                        if ( metadata.common.picture.length >= 1 )
                        {
                            res.type( metadata.common.picture[0].format);
                        }
                        res.send( metadata.common.picture[0].data );
                    }
                    else { errorRedirect(res,"No cover available", textOnly=false); }
                }
                else
                {
                    if (metadata.format.container.match(/M4A/i) )
                    {
                        res.type('audio/x-m4a');
                    }
                    else { res.type('audio/mpeg'); }

                    // Send a readable stream with the audio,
                    // Client usage:
                    //  <audio src="/audio/[playlist]/[trackNum]>"
                    return res.send(stream);
                }
            }
            else { errorRedirect(res, `'${req.params.playlist}' only has ${track_count} tracks`, textOnly=true); }
        }
        else { errorRedirect(res, `No such playlist: ${req.params.playlist}`, textOnly=true); }
    }

    return { getTokenParams, errorRedirect, stateString, getAuthHeader, tokenRequest, getLocalPlaylists, getTrackData };
};
