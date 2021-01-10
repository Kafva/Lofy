// TODO
//  * Fix copying of modules into public/modules
//  * Fix it so that one can go directly to /home 
//  * Rename refresh= parameter to 'textOnly'
//  * Shuffle gets fcked when switching playlists
//  * Server crashes sometimes when non-existant files are found in a playlist(?)
//  ### Spotify
//      * seek (https://developer.spotify.com/documentation/web-api/reference/player/seek-to-position-in-currently-playing-track/)
//      * Cache playlist-tracks fetch
//  ### Local files
//      1. Begin work with combining local+spotify players
//      * Translate emojis to text (https://www.npmjs.com/package/emoji-text OR port emoji.bash)
//      * ~/Music/iTunes/iTunes\ Media/Music
//  ### Soundcloud
//      * Currently not avaialable: https://soundcloud.com/you/apps/new
//  ### Front-end
//      * basic cute look
//      * Source indicator for current media
//      * Sound wave thing
//      * Optional display for all metadata
//      * Mobile integration
//      * Search function to play specific track(s) 
//      * Repeat current track button

// When we exit and re-enter silence may be playing

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
            case CONSTS.seekForward:
                seekPlayback(CONSTS.seekStep);
                break;
            case CONSTS.seekBack:
                seekPlayback(-CONSTS.seekStep);
                break;
        }
    }
}

//**** MEDIA KEYS *****/
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
    if (GLOBALS.currentSource == SPOTIFY_SOURCE)
    {
        let _json = await getPlayerJSON();
        if (_json != undefined)
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
    else if ( GLOBALS.currentSource == LOCAL_SOURCE )
    {
        let playlist = await getLocalPlaylistJSON( CONSTS.audioSources.local.getCurrentPlaylist() );
        if (playlist != undefined && playlist != [])
        {
            trackIndex = GLOBALS.prevNum.local - 1;
            let track = playlist.tracks[trackIndex];

            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                album: track.album,
                artwork: [
                    {
                        src: `/cover/${ CONSTS.audioSources.local.getCurrentPlaylist() }/${trackIndex}`,
                        sizes: `${track.cover.width || 0}x${track.cover.height || 0}`,
                        type: `image/${track.cover.type || 'png'}`
                    }
                ] 
            });
        }
        else { console.error(`setupMediaMetadata(): getLocalPlaylistJSON ==> ${playlists}`); }

    }
    
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
            playSpotifyTrack( CONSTS.audioSources.spotify.getCurrentPlaylist(), player); 
            break;
        case 'devices':
            getDeviceJSON(debug=true); 
            break;
        //-- Requires player to be active --//
        case 'pauseToggle':
            togglePlayback( CONSTS.audioSources.spotify.getCurrentPlaylist(), player); 
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
        case 'seekForward':
            seekPlayback(CONSTS.seekStep);
            break;
        case 'seekBack':
            seekPlayback(-CONSTS.seekStep);
            break;

        //-- Debug ---//
        case 'playerInfo':
            getPlayerJSON(debug=true);
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
        // We cannot fetch the currenly queued tracks via the API, the best we can do for now
        console.log('player_state_changed', state); 

        if ( GLOBALS.currentSource == SPOTIFY_SOURCE )
        {
            (async () =>
            {
                track = await getCurrentTrack();
            
                if ( track.item.uri == CONSTS.spotifySilence )
                // Check if we are currently listening to 'silence'
                {
                    console.log(`THIS IS ${track.item.name}`);
                    
                    if ( GLOBALS.mutexTaken == false)
                    // Ensure that no other 'player_state_change' event is in the
                    // process of starting a new track
                    {
                        GLOBALS.mutexTaken = true;
                        console.log("Mutex taken!");

                        switch ( audioSourceCoinflip() )
                        {
                            case SPOTIFY_SOURCE:
                                playSpotifyTrack( CONSTS.audioSources.spotify.getCurrentPlaylist(), player );    
                                break;
                            case LOCAL_SOURCE:
                                // Pause Spotify and start playing from the local source
                                await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                                    method: 'PUT',
                                    headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                                });
                                playTrack(); 
                        }

                        // Short wait before releasing the mutex
                        await new Promise(r => setTimeout(r, CONSTS.newTrackDelay));
                        GLOBALS.mutexTaken = false;
                        console.log("Mutex released!");
                    }
                }
                else
                {
                    // Update the current track and mediaSession metadata
                    updateCurrentTrackUI();
                    setupMediaMetadata();
                }

            })();

        }

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

//******** AUDIO SOURCE MANAGMENT *********/

const updatePlaylistCount = async (audioSource) =>
{
    switch ( audioSource )
    {
        case SPOTIFY_SOURCE:
            let _json =  await getPlaylistJSON( CONSTS.audioSources.spotify.getCurrentPlaylist());
            if (_json != null && _json != undefined)
            {
                GLOBALS.playlistCount.spotify = _json.tracks.total; 
            }
            break;
        case LOCAL_SOURCE:
            await updateLocalPlaylistCount();
            break;
        default:
            console.error(`Unknown audioSource: ${audioSource}`);
    }

    if ( GLOBALS.playlistCount[audioSource] == null && 
        CONSTS.audioSources[audioSource].getCurrentPlaylist() != CONSTS.noContextOption )
    { 
        console.error(`Failed to update ${audioSource} count`); 
    }
}

const audioSourceCoinflip = () =>
// Returns a random (weighted based on the number of tracks from each source) 
// key from CONSTS.audioSources to determine from which source 
// the next track will be picked from
{
    // Spotify counter is updated in:
    //  - Upon 'change' of #spotifyPlaylist
    //  - InitSpotifyPlayer()
    // Local counter is updated in:
    //  - Upon 'change' of #localPlaylist
    //  - InitLocalPlayer()

    let total_tracks = 0;
    
    for (let source of Object.keys( CONSTS.audioSources ) )
    // Ensure that each playlist has a count and sum up the total number of tracks
    {
        if ( GLOBALS.playlistCount[source] == null ) { updatePlaylistCount(source); }
        total_tracks += GLOBALS.playlistCount[source];
    }

    // The algorithm will give a fair disrubtion where every track has the same
    // likliehood to play (1/250 in the example below):
    
    // [0,199  ]   ==> spotify (200 tracks)
    // [200,250]   ==> local   (50 tracks)

    let outcome = Math.floor( Math.random() *  total_tracks )
    let _total = 0;
    
    for (let source of Object.keys( CONSTS.audioSources ) )
    {
        _total += GLOBALS.playlistCount[source];
        if ( outcome <= _total ) { return source; }
    }
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
