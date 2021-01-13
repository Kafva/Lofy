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
    player.addListener('player_state_changed', state => 
    { 
        console.log('player_state_changed', state); 
        handleSpotifyTrackEnd(player);
    });

    // Ready
    player.addListener('ready', ({ device_id }) => 
    { 
        console.log('Ready with Device ID', device_id);
        InitSpotifyPlayer(player);
    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => { console.log('Device ID has gone offline', device_id); });
}

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

//********** Spotify API Actions ******************/

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
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
    
    // Set auto-repeat state
    await fetch(`https://api.spotify.com/v1/me/player/repeat?state=${CONFIG.defaultAutoRepeatState}&device_id=${player._options.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });
    
    // Set volume to <default> %
    setSpotifyVolume(-1, CONFIG.defaultPercent);

    // Fetch the users playlists and add them as options in the UI
    await setupSpotifyPlaylistsUI();

    // Update the playlist track counter
    updatePlaylistCount(SPOTIFY_SOURCE);

    // Add the tracks from the playlist to the UI
    addPlaylistTracksToUI(SPOTIFY_SOURCE);
}

const playSpotifyTrack = async (playlistName, player, trackNum=null) => 
// Start playback with a random track from the provided playlist followed by silence
// If a prevIndex from HISTORY is provided the corresponding track from the playlist will be chosen
{
    GLOBALS.currentSource = SPOTIFY_SOURCE;

    // TODO this line should not be needed
    if (playlistName == CONFIG.noContextOption) { console.error(`Can't play tracks from '${CONFIG.noContextOption}'`); return null; }
    var track = null;
    tracks_json   = await getTracksJSON(playlistName);
    
    if ( trackNum == null )
    /* (historyPos:0) ==> Play a new track */
    {
        trackNum = getNewTrackNumber( GLOBALS.currentPlaylistCount.spotify );
   
        // If we are playing a new track we should add it to the HISTORY
        addTrackToHistory(SPOTIFY_SOURCE, trackNum, tracks_json[trackNum].track.uri); 
    }
    /* (historyPos >= 1) ==> Play next track in HISTORY */
    // The next track is guaranteed to be a Spotify track from the base selection in `playPrevTrack()`
    // and is passed as an argument
    
    track     = tracks_json[trackNum].track; 
    
    console.log(`Track JSON for ${track.name}:`, track);

    // Start playback 
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${player._options.id}`, {
        method: 'PUT',
        body: JSON.stringify( { uris: [ track.uri, CONFIG.spotifySilence ] } ),
        //body: JSON.stringify({ context_uri: (await getPlaylistJSON(playlistName)).uri }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookiesAsJSON().access_token}`
        },
    });

    // Fetch the current track (after a short delay)
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
    updateCurrentTrackUI();

    // Start the dummy player and set a value for the dummyProgressOffset
    updateDummyPlayerStatus('play');
    setDummyProgressOffset();

    // Set a value for the duration on the progress bar
    let sec = Math.floor(( track.duration_ms /1000)%60);
    if (sec <= 9 && sec >= 0){ sec = `0${sec}`; }
    
    GLOBALS.currentDuration = 
    {
        sec: sec,
        min: Math.floor((track.duration_ms/1000)/60) 
    } 

    // Update the volume indicator (relevant after a switch from the localPlayer)
    document.querySelector("#volume").innerText = `${ Math.floor( (await getPlayerJSON()).device.volume_percent ) } %`;

    // Setup media Session metadata
    setupMediaMetadata();
}

const getCurrentSpotifyTrack = async () =>
{
    // Fetch the current song and display its name
    let res = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
    });

    let body = await res.text();
    try { return JSON.parse(body)  }
    catch (e) { console.error(e,body); return null; }
}

const toggleSpotifyPlayback = async (playlistName, player, pauseOnly=false) => 
{
    //*** NOTE that one cannot directly ['index'] the return value from an async function */
    let _json = await getDeviceJSON()
    if (_json != null && _json != undefined)
    {
        if (!_json['is_active'])
        // If the player is not active start it
        {
            if (!pauseOnly)
            {
                await playSpotifyTrack(playlistName, player);
            }
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
                    updateDummyPlayerStatus('pause');
                }
                else
                {
                    if(!pauseOnly)
                    {
                        await fetch(`https://api.spotify.com/v1/me/player/play`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                        });
                        updateDummyPlayerStatus('play');
                    }
                }
            }
            else { console.error(`toggleSpotifyPlayback(): getPlayerJSON() ==> ${_json}`); }
        }
    }
    else { console.error(`toggleSpotifyPlayback(): getDeviceJSON() ==> ${_json}`); }
}

const setSpotifyVolume = async (diff, newPercent=null ) =>
// Change the volume by diff percent or to a static value
{
    let _json = await getDeviceJSON()
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

            document.querySelector("#volume").innerText = `${newPercent} %`;
        }
        else { console.log(`setSpotifyVolume(): invalid percent ${newPercent}`); }
        
    }
    else { console.log(`setSpotifyVolume(): ${CONFIG.inactivePlayer}`); }
}

const seekSpotifyPlayback = async (ms) =>
{
    // TODO will skip to the next/prev track if the seek operation overflows the scope of the track
    // could cause bugs
    let track_json = await getCurrentSpotifyTrack();
    console.log(track_json);
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
    if (name == CONFIG.noContextOption) { return null; }
    
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
                return item;
            }   
        }
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

    body = await res.text();
    
    try { devices = JSON.parse(body)['devices'];  }
    catch (e) { console.error(e,devices); return null; }

    for (let item of devices)
    {
        if (item['name'] == CONFIG.playerName)
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
    body = await res.text();
    try
    {
        body = JSON.parse(body)
    }
    catch(e){ console.error(e); return null; }

    return body;
}

const getTracksJSON = async (playlistName) =>
{
    if ( playlistName == CONFIG.noContextOption ){ return null; }
    playlist_json = await getPlaylistJSON(playlistName);
    
    // The API only allows for 100 tracks to be returned per request, we must therefore issue several fetches
    // to aquire all the tracks of a playlist
    if ( GLOBALS.currentPlaylistCount.spotify == null && getCurrentPlaylist(SPOTIFY_SOURCE) == playlistName )
    { 
        updatePlaylistCount(SPOTIFY_SOURCE); 
    }
    let tracks = [];
    
    while ( tracks.length < playlist_json.tracks.total )
    {
        let res = await fetch(`https://api.spotify.com/v1/playlists/${playlist_json.id}/tracks?offset=${tracks.length}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
        });

        body = await res.text();

        try 
        { 
            tracks = tracks.concat( JSON.parse(body)['items'] );  
        }
        catch (e) { console.error(e); return null; }
    }

    return tracks;
}

//************** HELPER ***************/

const handleSpotifyTrackEnd = async (player) =>
{
    if ( GLOBALS.currentSource == SPOTIFY_SOURCE )
    {
        track = await getCurrentSpotifyTrack();
    
        if ( track.item.uri == CONFIG.spotifySilence )
        // Check if we are currently listening to 'silence'
        {
            console.log(`Listening to: ${track.item.name}`);
            
            if ( GLOBALS.mutexTaken == false)
            // Ensure that no other 'player_state_change' event is in the
            // process of starting a new track
            {
                GLOBALS.mutexTaken = true;
                console.log("Mutex taken!");

                playNextTrack(player);

                // Short wait before releasing the mutex
                await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
                GLOBALS.mutexTaken = false;
                console.log("Mutex released!");
            }
        }
    }

} 

const setupSpotifyPlaylistsUI = async () =>
{
    let playlists = await getPlaylistJSON(name=false);

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
