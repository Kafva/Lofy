import { DEBUG, CONFIG } from './clientConfig.js'

const refreshToken = async (spotifyPlayer) =>
{
    // Wait the time specified by expires_in and after that send a request to the
    // servers /refresh endpoint to update the access_token
    await new Promise(r => setTimeout(r, ( getCookiesAsJSON().expires_in-10)*1000));
    
    let xhr = new XMLHttpRequest();
    xhr.open('GET', '/refresh?' + `refresh_token=${getCookiesAsJSON().refresh_token}`, true);

    xhr.onload = () => 
    {
        let res = null;
        // The response from the server should be a redirect to /home
        // with new parameters
        if(DEBUG) console.log("Recived response from /refresh: ", xhr.response, JSON.parse(xhr.response), );
        try
        {
            res = JSON.parse(xhr.response) 
        }
        catch(e){ console.error("Non-parsable response", xhr.response); return; }

        // Replace the Cookie values for access_token and expires_in
        document.cookie = `access_token=${res.access_token}`;
        document.cookie = `expires_in=${res.expires_in}`;

        // The response may or may not contain a new refresh token
        if (res.refresh_token !== undefined)
        {
            document.cookie = `refresh_token=${res.refresh_token}`;
        }

        // Restart the refreshToken() loop
        refreshToken(spotifyPlayer);
    };
    
    xhr.send();
}

const InitSpotifyPlayer = async (spotifyPlayer) =>
{
    // Activate the web spotifyPlayer (without starting any music)
    await fetch(`https://api.spotify.com/v1/me/player`, {
        method: 'PUT',
        body: JSON.stringify({ 
            device_ids: [ spotifyPlayer._options.id ],
            play: false
        }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookiesAsJSON().access_token}`
        },
    });
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
    
    // Set auto-repeat state
    await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${CONFIG.defaultAutoRepeatState}&device_id=${spotifyPlayer._options.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    // Set shuffle state off ('silence' might be played first otherwise)
    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=false`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    // Set volume to <default> %
    try { setSpotifyVolume(-1, CONFIG.defaultPercent); }
    catch (e) { console.error(e); }


    // Fetch the users playlists and add them as options in the UI
    await setupSpotifyPlaylistsUI();
}

//********** Spotify API Actions ******************/

const getCurrentSpotifyTrack = async () =>
{
    // Fetch the current song and display its name
    let res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

    let body = null;
    try 
    { 
        body = await res.text();
        return JSON.parse(body)  
    }
    catch (e) { console.error(e,body); }
}

const setSpotifyVolume = async (diff, newPercent=null ) =>
// Change the volume by diff percent or to a static value
{
    let _json = await getDeviceJSON();
    if (_json['is_active'])
    {
        if (newPercent == null)
        // Use diff paramater
        {
            // Fetch the current volume
            _json = await getPlayerJSON();
            if(_json['device'] != undefined)
            { 
                newPercent = _json['device']['volume_percent'] + diff;
            }
            else { throw("Failed to fetch device info"); }
        }
        
        if ( 0 <= newPercent && newPercent <= 100 )
        {
            fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${newPercent}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
            });

            document.querySelector("#volume").innerText = `${newPercent} %`;
        }
        else { throw(`Invalid percent ${newPercent}`); }
        
    }
    else { throw(`Inactive player: ${CONFIG.inactivePlayer}`); }
}

const seekSpotifyPlayback = async (ms) =>
{
    // Will skip to the next/prev track if the seek operation overflows the scope of the track
    // could cause bugs
    let track_json = await getCurrentSpotifyTrack();
    if(DEBUG) console.log(track_json);
    fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${track_json.progress_ms + ms}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

}

//************** JSON Fetches ***************/

const getPlaylistJSON = async (name) =>
// Return the JSON object corresponding to the given playlist
// Or the base JSON with all playlists if no name is given
{
    // Edge-case if the context doesn't correspond to a playlist
    if ( name == CONFIG.noContextOption ){ throw(`Cant fetch tracks for ${CONFIG.noContextOption}`); }
    
    let res = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    let playlists = null;
    try 
    { 
        let body = await res.text();
        playlists = JSON.parse(body)['items'];  
    }
    catch (e) { throw(e,devices); }

    if (name != null)
    {
        for (let item of playlists)
        {
            if (item['name'] == name)
            {
                return item;
            }   
        }

        throw(`'${name}' not found among playlists`);
    }
    else { return playlists; }
}

const getDeviceJSON = async () =>
// async functions always return a Promise for their return value
{
    let res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

    let devices = null;
    
    try 
    { 
        let body = await res.text();
        devices = JSON.parse(body)['devices']; 
    }
    catch (e) { throw(e); }

    for (let item of devices)
    {
        if (item['name'] == CONFIG.spotifyPlayerName)
        {
            return item;
        }   
    }
    return null;
}

const getPlayerJSON = async () =>
{
    // The Content-Type header is only neccessary when sending data in the body
    let res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    // Instead of using a readable stream we can fetch the complete response body
    // with a Promise via text()
    let body = await res.text();
    try
    {
        body = JSON.parse(body)
    }
    catch(e){ throw(e); }
    if(body == null){ throw("Empty response from /player"); }

    return body;
}

//************** MISC ***************/

const toggleDummyPlayerStatusForSpotify = (mode) =>
{
    switch(mode)
    {
        case CONFIG.pause:
            document.querySelector("#dummy").pause();
            break;
        case CONFIG.play:
            document.querySelector("#dummy").play();
            break;
    }
}

const setupSpotifyPlaylistsUI = async () =>
{
    let playlists = await getPlaylistJSON();

    // Determine the current playlist (if any)
    let playlist_url = false;
    let _json = await getPlayerJSON();
    if (_json != undefined && _json != null)
    {
        if (_json.context != null)
        {
            playlist_url = _json.context.external_urls.spotify;
        }
    }

    if (!playlist_url)
    // Default option when no context is found
    {
        let opt = document.createElement("option"); 
        opt.innerText = CONFIG.noContextOption;
        document.querySelector("#spotifyPlaylist").add(opt);
    }

    for (let item of playlists)
    {
        let opt = document.createElement("option"); 
        opt.innerText = item.name;
        
        if ( playlist_url != false )
        {
            // Set the current playlist as selected
            if ( item.external_urls.spotify == playlist_url  ){ opt.setAttribute("selected",""); }
        }
        else
        {
            // Use the configurations default playlist if none is found
            if ( opt.innerText == CONFIG.defaultSpotifyPlaylist ){ opt.setAttribute("selected",""); }
        }
        
        document.querySelector("#spotifyPlaylist").add(opt);
    }

}

const getCookiesAsJSON = () =>
{
    let param_dict = {};
    for (let obj of document.cookie.split("; "))
    { 
        let [key,val] = obj.split("=");
        if (key == "expires_in")
        {
            param_dict[key] = parseInt(val);
        }
        else { param_dict[key] = val; }
    }

    return param_dict;
}

//********** EXPORTS ******************/
export { 
    refreshToken, getCookiesAsJSON,
    
    InitSpotifyPlayer, setSpotifyVolume, seekSpotifyPlayback,
    getDeviceJSON, getPlayerJSON, getPlaylistJSON, getCurrentSpotifyTrack,
    toggleDummyPlayerStatusForSpotify,
};