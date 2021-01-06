// TODO
//  * Media key support (across all sources)
//  ### Spotify
//      * Pick playlist
//  ### Local files
//      * ~/Music/iTunes/iTunes\ Media/Music
//  ### Soundcloud
//  ### Front-end

//********** EVENT HANDLING ******************/

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
// The spotify <iframe> contains the actual web player and its own mediaSession object which we can't access due to SOP
// https://github.com/spotify/web-playback-sdk/issues/105
// https://stackoverflow.com/questions/25098021/securityerror-blocked-a-frame-with-origin-from-accessing-a-cross-origin-frame

// As a work-around we use a dummy <audio> object which we register `ActionHandlers` for,
// the spotify iframe will still catch <PAUSE> events but our own dummy object will be notified
// as well when this occurs. 

const dummyAudioHandler = (mode) =>
// Activated when the pause/play media keys are pressed
{
    navigator.mediaSession.playbackState = mode;  
    console.log(mode,event);
    event.stopPropagation();
}

const updatePlayerStatus = (mode) =>
// Start/Stop the dummy player and update the UI
{
    if (mode == 'pause')
    {
        document.querySelector("#dummy").pause();
        document.querySelector("#pauseToggle").innerText = CONSTS.playText;
    }
    else if ( mode == 'play' )
    {
        document.querySelector("#dummy").play();
        document.querySelector("#pauseToggle").innerText = CONSTS.pauseText;
        setupMediaMetadata();
    }
}

const setupMediaMetadata = async () =>
// Setup metadata for mediaSession
{
    let _json = await getPlayerJSON();
    if (_json != undefined && _json != null)
    {
        artwork = [];
        for (let item of _json['item']['album']['images'])
        {
            artwork.push( { 
                src: item.url, 
                sizes: `${item.width}x${item.height}`, 
                type: 'image/png' 
            });
        } 
        navigator.mediaSession.metadata = new MediaMetadata({
            title: _json['item'].name,
            artist: _json['item']['artists'][0].name,
            album: _json['item']['album'].name,
            artwork: artwork
        });
    }
    else { console.error(`setupMediaMetadata(): getPlayerJSON() ==> ${_json}`); }
}

const mediaHandlers = () =>
{
    if ('mediaSession' in navigator) 
    {
        navigator.mediaSession.setActionHandler('play', async () => 
        { 
            console.log(`----PLAY---- (${navigator.mediaSession.playbackState})`); 
            
            // Wait a bit for the spotify player state to update (via the reaction from the iframe) before checking it
            await new Promise(r => setTimeout(r, CONSTS.newTrackDelay));
            
            let _json = await getPlayerJSON();

            if ( _json['is_playing'] === false )
            // If the spotify player is not playing, start it
            {
                await fetch(`https://api.spotify.com/v1/me/player/play`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                });
            }
            updatePlayerStatus('play');
        });
        navigator.mediaSession.setActionHandler('pause', async () => 
        { 
            console.log(`----PAUSE---- (${navigator.mediaSession.playbackState})`); 

            // Wait a bit for the spotify player state to update before checking it
            await new Promise(r => setTimeout(r, CONSTS.newTrackDelay));

            let _json = await getPlayerJSON();

            if ( _json['is_playing'] === true )
            // If the spotify player is playing, pause it
            {
                await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                });
            }
            updatePlayerStatus('pause');
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => 
        { 
            console.log("----PREV----");
            skipTrack(next=false); 
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => 
        { 
            console.log("----NEXT-----"); 
            skipTrack();
        });
    }
}

const clickHandler = (player) =>
{
    switch (event.target.id)
    {
        case 'play':
            startPlayer(CONSTS.playlistName, player); 
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
    player.addListener('player_state_changed', state => 
    { 
        console.log('player_state_changed', state); 
        
        // Update the current track and mediaSession metadata
        getCurrentTrack();
        setupMediaMetadata();
    });

    // Ready
    player.addListener('ready', ({ device_id }) => 
    { 
        console.log('Ready with Device ID', device_id);
        InitPlayer(player);
    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => { console.log('Device ID has gone offline', device_id); });
}

//********* MISC *********//

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