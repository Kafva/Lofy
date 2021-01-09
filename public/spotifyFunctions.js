//********** Spotify API Endpoints ******************/

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

const InitSpotifyPlayer = async (player) =>
{
    // Activate the web player (without starting any music)
    await fetch(`https://api.spotify.com/v1/me/player`, {
        method: 'PUT',
        body: JSON.stringify({ 
            device_ids: [ player._options.id ],
            play: false
        }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookiesAsJSON().access_token}`
        },
    });
    await new Promise(r => setTimeout(r, CONSTS.newTrackDelay));
    
    // Enable shuffle (after a wait to activate the player) 
    await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=true&device_id=${player._options.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    // Set volume to <default> %
    setVolume(-1, CONSTS.defaultPercent);

    // Fetch the users playlists and add them as options in the UI
    let playlists = await getPlaylistJSON(name=false);

    // Determine the current playlist (if any)
    let _json = await getPlayerJSON();
    if (_json != undefined && _json != null)
    {
        playlist_url = _json.context.external_urls.spotify;
    }

    for (let item of playlists)
    {
        let opt = document.createElement("option"); 
        opt.innerText = item.name;
        
        // Set the current playlist as selected
        if ( item.external_urls.spotify == playlist_url  ){ opt.setAttribute("selected",""); }
        
        document.querySelector("#spotifyPlaylist").add(opt);
    }

    // Update the playlist track counter
    GLOBALS.spotify_playlist_count = ( await getPlaylistJSON( getCurrentSpotifyPlaylist()) ).tracks.total;
}

const startPlayer = async (playlistName, player) => 
// Note that we only enter this function when the player is inactive
{
    // The URI supplied in the body for /play can reference a playlist, track etc.
    playlist_json = await getPlaylistJSON(playlistName);

    // Start playback 
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${player._options.id}`, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: playlist_json['uri'] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookiesAsJSON().access_token}`
        },
    });

    // Fetch the current track (after a short delay)
    await new Promise(r => setTimeout(r, CONSTS.newTrackDelay));
    await getCurrentTrack();

    updatePlayerStatus('play');
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
            await startPlayer(playlistName, player);
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
                    updatePlayerStatus('pause');
                }
                else
                {
                    await fetch(`https://api.spotify.com/v1/me/player/play`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                    });
                    updatePlayerStatus('play');
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
        await new Promise(r => setTimeout(r, 2000));
        await getCurrentTrack();

        // Update the mediaSession metadata
        setupMediaMetadata();
    }
    else { console.log(`skipTrack(): ${CONSTS.inactivePlayer}`); }
}

//****** JSON Fetches  *********/

const getPlaylistJSON = async (name, debug=false) =>
// Return the JSON object corresponding to the given playlist
// Or the base JSON with all playlists if no name is given
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

    if (name != false)
    {
        for (let item of playlists)
        {
            if (item['name'] == name)
            {
                if (debug) { document.querySelector('#debugSpace').innerText = JSON.stringify(item); }
                return item;
            }   
        }
    }
    else { return playlists; }
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