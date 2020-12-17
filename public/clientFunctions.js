//********** EVENT HANDLING ******************/

const refreshToken = async (player, access_token, refresh_token, expires_in) =>
{
    // NOTE that the listener does not take any arguments, the player and access_token
    // variables from the current context will therefore be passed to the click-handler
    let listener = () => clickHandler(player,access_token);

    // Instead of setting specific events for specific elements we will use a global catch all
    // listener and redirect events based on what was clicked 
    window.addEventListener('click', listener, true);

    // Wait the time specified by expires_in and after that send a request to the
    // servers /refresh endpoint to update the access_token
    await new Promise(r => setTimeout(r, (expires_in-10)*1000));
    
    //console.log("Waiting...")
    //await new Promise(r => setTimeout(r, 10*1000));
    
    let xhr = new XMLHttpRequest();
    xhr.open('GET', '/refresh?' + `refresh_token=${refresh_token}`, true);

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

        // Deregister the event-listener for the window and let the next invocation of
        // refreshToken() re-add it with the new access_token
        window.removeEventListener('click', listener, useCapture=true);
        
        access_token = res.access_token

        if (res.refresh_token !== undefined)
        // Restart the refreshToken() loop with the new refresh_token (if one was given)
        {
            refreshToken(player,  access_token, res.refresh_token, res.expires_in);
        }
        else { refreshToken(player,  access_token, refresh_token, res.expires_in); }
    };
    
    xhr.send();
}

//** Keyboard shortcuts **/

const clickHandler = (player, access_token) =>
{
    switch (event.target.id)
    {
        case 'play':
            startPlayer(access_token, CONSTS.playlistName, player._options.id); 
            break;
        case 'devices':
            getDeviceJSON(access_token, debug=true); 
            break;
        //-- Requires player to be active --//
        case 'pauseToggle':
            togglePlayback(access_token); 
            break;
        case 'volumeUp':
            setVolume(access_token, CONSTS.volumeStep);
            break;
        case 'volumeDown':
            setVolume(access_token, -CONSTS.volumeStep);
            break;
        case 'previous':
            skipTrack(access_token, next=false);
            break;
        case 'next':
            skipTrack(access_token);
            break;
        //-- Debug ---//
        case 'playerInfo':
            getPlayerJSON(access_token, debug=true);
            break;
        case 'playlist':
            fetchTracks(access_token,CONSTS.playlistName);
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

const startPlayer = async (access_token, playlistName, playerId) => 
{
    playlist_json = await getPlaylistJSON(access_token, playlistName);
    
    // The URI supplied in the body can reference a playlist, track etc.
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: playlist_json['uri'] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
    
    // Set volume to <default> %
    setVolume(access_token, -1, CONSTS.defaultPercent);
    
    // Enable shuffle and fetch the current track (after a short delay)
    await new Promise(r => setTimeout(r, 1000));
    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${access_token}` },
    });

    await getCurrentTrack(access_token);

    // Set the pause button
    document.querySelector("#pauseToggle").innerText = "< Pause >";
}

const getCurrentTrack = async (access_token) =>
{
    // Fetch the current song and display its name
    let res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${access_token}` },
    });

    let body = await res.text();

    try { track = JSON.parse(body)['item']  }
    catch (e) { console.error(e,body); return null; }

    document.querySelector("#currentTrack").innerText = `Current track: ${track['name']}`;
}

const togglePlayback = async (access_token) => 
{
    //*** NOTE that one cannot directly ['index'] the return value from an async function */
    let _json = await getDeviceJSON(access_token)
    if (_json != null && _json != undefined)
    {
        if (_json['is_active'])
        {
            _json = await getPlayerJSON(access_token)
            if (_json != null && _json != undefined)
            {
                if (_json['is_playing'])
                {
                    await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${access_token}` },
                    });
                    document.querySelector("#pauseToggle").innerText = "< Play >";
                }
                else
                {
                    await fetch(`https://api.spotify.com/v1/me/player/play`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${access_token}` },
                    });
                    document.querySelector("#pauseToggle").innerText = "< Pause >";
                }
            }
            else { console.error(`togglePlayback(): getPlayerJSON() ==> ${_json}`); }
        }
    }
    else { console.error(`togglePlayback(): getDeviceJSON() ==> ${_json}`); }
}

const setVolume = async (access_token, diff, newPercent=null ) =>
// Change the volume by diff percent or to a static value
{
    let _json = await getDeviceJSON(access_token)
    console.log("is_active", _json, _json['is_active'])

    if (_json['is_active'])
    {
        if (newPercent == null)
        // Use diff paramater
        {
            // Fetch the current volume
            _json = await getPlayerJSON(access_token)
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
                headers: { 'Authorization': `Bearer ${access_token}` },
            });

            document.querySelector("#volume").innerText = `< ${newPercent} % >`
        }
        else { console.log(`setVolume(): invalid percent ${newPercent}`); }
        
    }
    else { console.log(`setVolume(): ${CONSTS.inactivePlayer}`); }
}

const skipTrack = async (access_token, next=true) =>
{
    let _json = await getDeviceJSON(access_token)
    console.log("is_active", _json, _json['is_active'])

    if (_json['is_active'])
    {
        let endpoint = 'next';
        if(!next) { endpoint = 'previous' }
        fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${access_token}` },
        });

        // Update the 'currently playing' indicator
        // after a short wait to avoid the previous song being fetched
        await new Promise(r => setTimeout(r, 1000));
        await getCurrentTrack(access_token);
    }
    else { console.log(`skipTrack(): ${CONSTS.inactivePlayer}`); }
}

//****** JSON Fetches  *********/

const getPlaylistJSON = async (access_token, name, debug=false) =>
// Return the JSON object corresponding to the given playlist
{
    console.log(`Token ${access_token}`)

    let res = await fetch('https://api.spotify.com/v1/me/playlists', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${access_token}` },
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

const getDeviceJSON = async (access_token, debug=false) =>
// async functions always return a Promise for their return value
{
    let res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${access_token}` },
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

const getPlayerJSON = async (access_token, debug=false) =>
{
    // The Content-Type header is only neccessary when sending data in the body
    let res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${access_token}` },
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

const fetchTracks = async (access_token, playlistName, debug=false) => 
{
    playlist_json = await getPlaylistJSON(access_token, playlistName)

    let res = await fetch(`https://api.spotify.com/v1/playlists/${playlist_json['id']}/tracks`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${access_token}` },
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
