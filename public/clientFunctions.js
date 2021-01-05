//********** EVENT HANDLING ******************/

// TODO
//  * Media key support
//  ### Spotify
//      * Use Set-Cookie request to transfer
//      * Read cookies inside event handler (no need to re-register)
//      * Check refreshToken() de-register of keyboard
//  ### Local files
//  ### Soundcloud
//  ### Front-end

const refreshToken = async (player) =>
{
    // Wait the time specified by expires_in and after that send a request to the
    // servers /refresh endpoint to update the access_token
    await new Promise(r => setTimeout(r, ( getCookiesAsJSON().expires_in-10)*1000));
    
    //console.log("Waiting...")
    //await new Promise(r => setTimeout(r, 10*1000));
    //console.log("Sending /refresh!");
    
    let xhr = new XMLHttpRequest();
    xhr.open('GET', '/refresh?' + `refresh_token=${getCookiesAsJSON().refresh_token}`, true);

    xhr.onload = () => 
    {
        // The response from the server should be a redirect to /home
        // with new parameters
        console.log("Recived response from /refresh: ", xhr.response, JSON.parse(xhr.response), );
        try
        {
            res = JSON.parse(xhr.response) 
        }
        catch(e){ console.error("Non-parsable response", xhr.response); }

        // Replace the Cookie values for access_token and expires_in
        document.cookie = `access_token=${res.access_token}`;
        document.cookie = `expires_in=${res.expires_in}`;

        // The response may or may not contain a new refresh token
        if (res.refresh_token !== undefined)
        {
            document.cookie = `refresh_token=${res.refresh_token}`;
        }

        // Restart the refreshToken() loop
        refreshToken(player);
    };
    
    xhr.send();
}

//**** Keyboard shortcuts ****/

const keyboardHandler = (event, player) => 
{
    console.log(`-------- ${event.key} | ${event.shiftKey} ----------`)   

    if ( event.key == CONSTS.pausePlay )
    {
        togglePlayback(CONSTS.playlistName, player); 
    }
    else if (event.shiftKey)
    // All keybinds except SPACE require SHIFT to be held
    {
        switch(event.key)
        {
            case CONSTS.volumeUp:
                setVolume(CONSTS.volumeStep);
                break;
            case CONSTS.volumeDown:
                setVolume(-CONSTS.volumeStep);
                break;
            case CONSTS.next:
                skipTrack();
                break;
            case CONSTS.previous:
                skipTrack(next=false);
                break;
        }
    }
}

//**** Media keys *****/

// throw new o(u.EME_API_NOT_SUPPORTED,"Platform does not support navigator.requestMediaKeySystemAccess").fatal();
// It seems like the Spotify Web API doesn't work in 'insecure' contexts (i.e. HTTP)


const mediaHandlers = () =>
{
    navigator.mediaSession.setActionHandler('play', function() { console.log("----PLAY----"); });
    navigator.mediaSession.setActionHandler('pause', function() { /* Code excerpted. */ });
    navigator.mediaSession.setActionHandler('stop', function() { /* Code excerpted. */ });
    //navigator.mediaSession.setActionHandler('seekbackward', function() { /* Code excerpted. */ });
    //navigator.mediaSession.setActionHandler('seekforward', function() { /* Code excerpted. */ });
    //navigator.mediaSession.setActionHandler('seekto', function() { /* Code excerpted. */ });
    navigator.mediaSession.setActionHandler('previoustrack', function() { /* Code excerpted. */ });
    navigator.mediaSession.setActionHandler('nexttrack', function() { console.log("----NEXT-----"); });
    //navigator.mediaSession.setActionHandler('skipad', function() { /* Code excerpted. */ });
}

const clickHandler = (player) =>
{
    switch (event.target.id)
    {
        case 'play':
            startPlayer(CONSTS.playlistName, player._options.id); 
            break;
        case 'devices':
            getDeviceJSON(debug=true); 
            break;
        //-- Requires player to be active --//
        case 'pauseToggle':
            togglePlayback(CONSTS.playlistName, player); 
            break;
        case 'volumeUp':
            setVolume(CONSTS.volumeStep);
            break;
        case 'volumeDown':
            setVolume(-CONSTS.volumeStep);
            break;
        case 'previous':
            skipTrack(next=false);
            break;
        case 'next':
            skipTrack();
            break;
        //-- Debug ---//
        case 'playerInfo':
            getPlayerJSON(debug=true);
            break;
        case 'playlist':
            fetchTracks(CONSTS.playlistName);
            break;

    }
}

const addPlayerListeners = (player) =>
{
    // See https://developer.spotify.com/documentation/web-playback-sdk/quick-start/
    // Error handling
    const errors = ['initialization_error', 'authentication_error', 'account_error', 'playback_error'];
    errors.forEach( (item) => 
    {
        player.addListener(item, ({message}) => console.error(`${item}:`, message)  );
    });

    // Playback status updates
    player.addListener('player_state_changed', state => { console.log('player_state_changed', state); });

    // Ready
    player.addListener('ready', ({ device_id }) => { console.log('Ready with Device ID', device_id); });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => { console.log('Device ID has gone offline', device_id); });
}

//********** API Endpoints ******************/

const startPlayer = async (playlistName, playerId) => 
{
    playlist_json = await getPlaylistJSON(playlistName);
    
    // The URI supplied in the body can reference a playlist, track etc.
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: playlist_json['uri'] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookiesAsJSON().access_token}`
        },
    });
    
    // Set volume to <default> %
    setVolume(-1, CONSTS.defaultPercent);
    
    // Enable shuffle and fetch the current track (after a short delay)
    await new Promise(r => setTimeout(r, 1000));
    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

    await getCurrentTrack();

    // Set the pause button
    document.querySelector("#pauseToggle").innerText = "< Pause >";
}

const getCurrentTrack = async () =>
{
    // Fetch the current song and display its name
    let res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

    let body = await res.text();

    try { track = JSON.parse(body)['item']  }
    catch (e) { console.error(e,body); return null; }

    document.querySelector("#currentTrack").innerText = `Current track: ${track['name']}`;
}

const togglePlayback = async (playlistName, player) => 
{
    //*** NOTE that one cannot directly ['index'] the return value from an async function */
    let _json = await getDeviceJSON()
    if (_json != null && _json != undefined)
    {
        if (!_json['is_active'])
        // If the player is not active start it
        {
            await startPlayer(playlistName, player._options.id);
        }
        else
        {
            _json = await getPlayerJSON()

            if (_json != null && _json != undefined)
            {
                if (_json['is_playing'])
                {
                    await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                    });
                    document.querySelector("#pauseToggle").innerText = "< Play >";
                }
                else
                {
                    await fetch(`https://api.spotify.com/v1/me/player/play`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                    });
                    document.querySelector("#pauseToggle").innerText = "< Pause >";
                }
            }
            else { console.error(`togglePlayback(): getPlayerJSON() ==> ${_json}`); }
        }
    }
    else { console.error(`togglePlayback(): getDeviceJSON() ==> ${_json}`); }
}

const setVolume = async (diff, newPercent=null ) =>
// Change the volume by diff percent or to a static value
{
    let _json = await getDeviceJSON()
    console.log("is_active", _json, _json['is_active'])

    if (_json['is_active'])
    {
        if (newPercent == null)
        // Use diff paramater
        {
            // Fetch the current volume
            _json = await getPlayerJSON()
            if(_json['device'] != undefined)
            { 
                newPercent = _json['device']['volume_percent'] + diff;
            }
            else { console.error("Failed to fetch device info"); }
        }
        
        if ( 0 <= newPercent && newPercent <= 100 )
        {
            fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${newPercent}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
            });

            document.querySelector("#volume").innerText = `< ${newPercent} % >`
        }
        else { console.log(`setVolume(): invalid percent ${newPercent}`); }
        
    }
    else { console.log(`setVolume(): ${CONSTS.inactivePlayer}`); }
}

const skipTrack = async (next=true) =>
{
    let _json = await getDeviceJSON()
    console.log("is_active", _json, _json['is_active'])

    if (_json['is_active'])
    {
        let endpoint = 'next';
        if(!next) { endpoint = 'previous' }
        fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
        });

        // Update the 'currently playing' indicator
        // after a short wait to avoid the previous song being fetched
        await new Promise(r => setTimeout(r, 1000));
        await getCurrentTrack();
    }
    else { console.log(`skipTrack(): ${CONSTS.inactivePlayer}`); }
}

//****** JSON Fetches  *********/

const getPlaylistJSON = async (name, debug=false) =>
// Return the JSON object corresponding to the given playlist
{
    console.log(`Token ${getCookiesAsJSON().access_token}`)

    let res = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    body = await res.text();
    let playlists = null;
    
    try { playlists = JSON.parse(body)['items'];  }
    catch (e) { console.error(e,devices); return null; }

    for (let item of playlists)
    {
        if (item['name'] == name)
        {
            if (debug) { document.querySelector('#debugSpace').innerText = JSON.stringify(item); }
            return item;
        }   
    }
    return null;
}

const getDeviceJSON = async (debug=false) =>
// async functions always return a Promise for their return value
{
    let res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

    body = await res.text();
    
    try { devices = JSON.parse(body)['devices'];  }
    catch (e) { console.error(e,devices); return null; }

    for (let item of devices)
    {
        if (item['name'] == CONSTS.playerName)
        {
            if (debug) { document.querySelector('#debugSpace').innerText =  JSON.stringify(item); }
            return item;
        }   
    }
    return null;
}

const getPlayerJSON = async (debug=false) =>
{
    // The Content-Type header is only neccessary when sending data in the body
    let res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    // Instead of using a readable stream we can fetch the complete response body
    // with a Promise via text()
    body = await res.text();
    try
    {
        body = JSON.parse(body)
    }
    catch(e){ console.error(e); return null; }

    if (debug) { document.querySelector('#debugSpace').innerText = JSON.stringify(body); }
    return body;
}

//********* MISC *********//

const fetchTracks = async (playlistName, debug=false) => 
{
    playlist_json = await getPlaylistJSON(playlistName)

    let res = await fetch(`https://api.spotify.com/v1/playlists/${playlist_json['id']}/tracks`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

    body = await res.text()
    
    try { tracks = JSON.parse(body);  }
    catch (e) { console.error(e,tracks); return null; }

    if (debug) { document.querySelector('#debugSpace').innerText = JSON.stringify(tracks); }
    return tracks;
}

const insertInfoList = (selector,param_dict) =>
{
    let ul = document.querySelector(selector);
    
    let li = document.createElement("li"); li.innerText = `cookie: ${document.cookie}` 
    ul.appendChild( li );
    
    for (let key in param_dict)
    {
        li = document.createElement("li"); li.innerText = `${key}:${param_dict[key]}` 
        ul.appendChild( li );
    }
}

const getParamDict = () =>
{
    var param_dict = {};
    
    let param_str = window.location.href.replace(/.*\/home\?/, '');
    let keys = param_str.split('&').map( (e) => [e.split('=')[0]]  ) 
    let vals = param_str.split('&').map( (e) => [e.split('=')[1]]  ) 
    for (let i=0; i<keys.length; i++){ param_dict[keys[i]] = vals[i]; }
    
    return param_dict;
}

const getCookiesAsJSON = () =>
{
    let param_dict = {};
    for (obj of document.cookie.split("; "))
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