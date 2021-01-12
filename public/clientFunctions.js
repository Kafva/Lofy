// BUGS
//  * Progress bar for Spotify bugs out
//  * Seek on local files

// TODO
//  * Incontsicies when metadata fails to load from some songs
//  * Server crashes sometimes when non-existant files are found in a playlist(?)
//  ### Spotify
//  ### Local files
//  ### Soundcloud
//      * Currently not avaialable: https://soundcloud.com/you/apps/new
//  ### Front-end
//      * Sound wave
//      * Mobile integration
//      * Display (hidable) current playlist(s) with clickable elements to play a track


//**** MEDIA KEYS *****/
// The spotify <iframe> contains the actual web player and its own mediaSession object which we can't access due to SOP
// https://github.com/spotify/web-playback-sdk/issues/105
// https://stackoverflow.com/questions/25098021/securityerror-blocked-a-frame-with-origin-from-accessing-a-cross-origin-frame

// As a work-around we use a dummy <audio> object which we register `ActionHandlers` for,
// the spotify iframe will still catch <PAUSE> events but our own dummy object will be notified
// as well when this occurs. 


const setupMediaMetadata = async () =>
// Setup metadata for mediaSession
{
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
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
            break;
        case LOCAL_SOURCE:
            track = await getCurrentLocalTrack();
            if (track != null)
            {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    artwork: [
                        {
                            src: `/cover/${ getCurrentPlaylist(LOCAL_SOURCE) }/${track.id}`,
                            sizes: `${track.cover.width || 0}x${track.cover.height || 0}`,
                            type: `image/${track.cover.type || 'png'}`
                        }
                    ] 
                });
            }
            else { console.error(`Failed to fetch metadata:`, track); }
            break;
    }
}

//******** AUDIO SOURCE MANAGMENT *********/

const playNextTrack = async (player) =>
{
    // If we are at (historyPos:0) play a new random track
    // Otherwise play the next track from the history
    // and decrement the historyPos closer to the most recent track
    var nextTrackNum = null;

    if ( GLOBALS.historyPos != 0 )
    {
        nextTrackNum = (getTrackHistoryJSON( --GLOBALS.historyPos )).trackNum ;
    }
    
    switch ( audioSourceCoinflip() )
    {
        case SPOTIFY_SOURCE:
            GLOBALS.currentSource = SPOTIFY_SOURCE;   
            document.querySelector("#localPlayer").pause();
            playSpotifyTrack( getCurrentPlaylist(SPOTIFY_SOURCE), player, nextTrackNum );    
            break;
        case LOCAL_SOURCE:
            // Pause Spotify and start playing from the local source
            GLOBALS.currentSource = LOCAL_SOURCE;   
            toggleSpotifyPlayback( getCurrentPlaylist(SPOTIFY_SOURCE), player, pauseOnly=true );
            playNextLocalTrack(nextTrackNum);
            break; 
    }
}

const playPrevTrack = async (player) =>
{
    // The history keeps the most recent track at (index:0)
    // To rewind we therefore play the track at (historyPos + 1)
    // AND increment the historyPos

    // Current track ==> (index : historyPos)
    if ( GLOBALS.historyPos + 1 < HISTORY.length )
    {
        prevTrack = getTrackHistoryJSON( ++GLOBALS.historyPos );
        
        if (prevTrack.spotifyURI != null)
        // Play previous track from spotify
        {
            document.querySelector("#localPlayer").pause();    
            playSpotifyTrack( getCurrentPlaylist(SPOTIFY_SOURCE), player, prevTrack.trackNum );    
        }
        else if ( prevTrack.trackNum != null )
        // Play previous track from local storage
        {
            // Pause Spotify (should it be playing) and start playing from the local source
            await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
            });

            // To play the previous local track we simply pass the prevTrack ID
            playLocalTrack(prevTrack.trackNum);
        }
        else { console.error("Invalid previous track:", prevTrack); }
    }
    else { console.error(`No track in HISTORY to rewind to: (HISTORY.length:${HISTORY.length}, historyPos:${GLOBALS.historyPos})`); return; }


}

const pauseToggle = (player) =>
{
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
            toggleSpotifyPlayback(getCurrentPlaylist(SPOTIFY_SOURCE), player);
            break;
        case LOCAL_SOURCE:
            toggleLocalPlayback();
            break;
        default:
            // If no source is playing start the player
            playNextTrack(player);
    }
}

const seekPlayback = (direction) =>
{
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
            seekSpotifyPlayback( direction * CONFIG.seekStepMs);
            document.querySelector("#dummy").currentTime += (direction * (CONFIG.seekStepMs/1000))
            break;
        case LOCAL_SOURCE:
            let p = document.querySelector("#localPlayer");
            p.currentTime = p.currentTime + ( direction * (CONFIG.seekStepMs/1000) );
            break;
    }
}

const updateProgressIndicator = () =>
{
    var min = 0;
    var sec = 0;
    
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
            if ( GLOBALS.dummyProgressOffset.sec == -1) 
            {
                console.error(`dummyProgressOffset unset: Can't show track progress`); 
                return null;
            }

            p = document.querySelector("#dummy");
            sec = Math.floor( (p.currentTime % 60) - GLOBALS.dummyProgressOffset.sec);
            min = Math.floor(( p.currentTime / 60) - GLOBALS.dummyProgressOffset.min);
            
            //if ( sec < 0 || min < 0 ){ min = 'err'; sec = 'err'; }
            if (sec <= 9){ sec = `0${sec}`; }
            break;
        case LOCAL_SOURCE:
            p = document.querySelector("#localPlayer");
            sec = Math.floor(p.currentTime % 60);
            min = Math.floor(p.currentTime / 60);

            //if ( sec < 0 || min < 0 ){ min = 'err'; sec = 'err'; }
            if (sec <= 9){ sec = `0${sec}`; }
            break;
    }
   
    if ( GLOBALS.currentDuration.sec == -1) 
    {
        console.error(`currentDuration unset: Can't show track progress`); 
        return null;
    }
    
    try
    {
        document.querySelector("#progress").innerText = 
            `${min}:${sec} / ${GLOBALS.currentDuration.min}:${GLOBALS.currentDuration.sec}`; 
    }
    catch (e) { console.error(e, min,sec, GLOBALS.currentDuration.min, GLOBALS.currentDuration.sec); }


}

const updateCurrentTrackUI = async () =>
{
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
            document.querySelector("#currentTrack").innerText = 
                `${ (await getCurrentSpotifyTrack()).item.name }`;    
            document.querySelector("#currentSource").setAttribute("class", CONFIG.spotifyIconCSS); 
            break;
        case LOCAL_SOURCE:
            document.querySelector("#currentTrack").innerText = 
                `${ (await getCurrentLocalTrack() ).title}`;    
            document.querySelector("#currentSource").setAttribute("class", CONFIG.localIconCSS); 
            break;
    }
}

//***** DUMMY PLAYER *******//

const updateDummyPlayerStatus = (mode) =>
// Start/Stop the dummy player and update the UI, if the source is NOT spotify
// we only update the UI
{
    if (mode == 'pause')
    {
        if( GLOBALS.currentSource == SPOTIFY_SOURCE ){ document.querySelector("#dummy").pause(); }
        document.querySelector("#pauseToggle").setAttribute("class", CONFIG.playClass);
    }
    else if ( mode == 'play' )
    {
        if( GLOBALS.currentSource == SPOTIFY_SOURCE ) { document.querySelector("#dummy").play(); }
        document.querySelector("#pauseToggle").setAttribute("class", CONFIG.pauseClass);
    }
}

const setDummyProgressOffset = () =>
// We will update the progress indicator upon:
//  * A new spotify track being played
// and thats it
{
    GLOBALS.dummyProgressOffset = 
    {
        sec: Math.floor(document.querySelector("#dummy").currentTime % 60),
        min: Math.floor(document.querySelector("#dummy").currentTime / 60),
    }
}

//********** HELPER *******//

const audioSourceCoinflip = () =>
// Returns a random (weighted based on the number of tracks from each source) 
// key from CONFIG.audioSources to determine from which source 
// the next track will be picked from
{
    // Spotify counter is updated in:
    //  - Upon 'change' of #spotifyPlaylist
    //  - InitSpotifyPlayer()
    // Local counter is updated in:
    //  - Upon 'change' of #localPlaylist
    //  - InitLocalPlayer()

    // If noContext is chosen for a source then we will always play from the other source
    if ( getCurrentPlaylist(SPOTIFY_SOURCE) == CONFIG.noContextOption ){ return LOCAL_SOURCE; }
    if ( getCurrentPlaylist(LOCAL_SOURCE)   == CONFIG.noContextOption ){ return SPOTIFY_SOURCE; }

    let total_tracks = 0;
    
    for (let source of Object.keys( GLOBALS.playlistCount ) )
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
    
    for (let source of Object.keys( GLOBALS.playlistCount ) )
    {
        _total += GLOBALS.playlistCount[source];
        if ( outcome <= _total ) { return source; }
    }
}

const getTrackHistoryJSON = (index=0) =>
// Returns a track from the HISTORY
//  index=0 ==> currently playing
//  index=1 ==> previous track
// and verfies that it contains the neccessary information
{
    if (HISTORY.length > index)
    { 
        if ( HISTORY[index].trackNum == null )
        { 
            console.error(`No trackNum information for: ${HISTORY[index]}`); 
        }
        return HISTORY[index];
    }
    else
    { 
        console.log(`HISTORY does not have enough entries to fetch [${index}]:`, HISTORY); 
        return {playlist: null, trackNum: null, spotifyURI: null}; 
    }

}

const updatePlaylistCount = async (audioSource) =>
{
    switch ( audioSource )
    {
        case SPOTIFY_SOURCE:
            let _json =  await getPlaylistJSON( getCurrentPlaylist(SPOTIFY_SOURCE));
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
        getCurrentPlaylist(audioSource) != CONFIG.noContextOption )
    { 
        console.error(`Failed to update ${audioSource} count`); 
    }
}

const addTrackToHistory = (source,trackNum,uri=null) => 
{
    while (HISTORY.length >= CONFIG.historyLimit) { HISTORY.pop(); }

    switch(source)
    // Add new tracks to the start of the list
    {
        case SPOTIFY_SOURCE:
            HISTORY = [ 
                {
                    playlist: getCurrentPlaylist(SPOTIFY_SOURCE),
                    trackNum: trackNum,
                    spotifyURI: uri
                }
            ].concat(HISTORY);
            break;
        case LOCAL_SOURCE:
            HISTORY = [ 
                {
                    playlist: getCurrentPlaylist(LOCAL_SOURCE),
                    trackNum: trackNum,
                    spotifyURI: null
                }
            ].concat(HISTORY);
            break;
    }
}

const getNewTrackNumber = (playlistLength,trackNum=null) =>
{
    // If all tracks in the playlist exist in the history, clear the history
    if ( HISTORY.filter( h => h.playlist == getCurrentPlaylist() ).length == playlistLength )
    {
        HISTORY = [];
    }

    while( HISTORY.filter( h => h.playlist == getCurrentPlaylist() )
    .some( h => h.trackNum == trackNum ) || trackNum == null )
    // Ensure that no track (from the current playlist) present in the history is picked
    {
        // We multiply by [length] and not [length-1]
        // Math.random() cannot return 1
        trackNum  = Math.floor( Math.random() * playlistLength ) + 1;
    }

    return trackNum;
}

const dummyAudioHandler = (mode) =>
// Activated when the pause/play media keys are pressed
{
    navigator.mediaSession.playbackState = mode;  
    console.log(mode,event);
    event.stopPropagation();
}

//********* MISC *********//

const getCurrentPlaylist = (source = GLOBALS.currentSource) =>
{
    switch(source)
    {
        case SPOTIFY_SOURCE:
            if ( document.querySelector("#spotifyPlaylist").length == 0 )
            {
                console.error("No Spotify playlists loaded (connection failure)");
            }
            else { return document.querySelector("#spotifyPlaylist").selectedOptions[0].innerText; }
        case LOCAL_SOURCE:
            return document.querySelector("#localPlaylist").selectedOptions[0].innerText;
    }
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