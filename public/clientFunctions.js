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
                for (let item of _json.item.album.images)
                {
                    artwork.push( { 
                        src: item.url, 
                        sizes: `${item.width}x${item.height}`, 
                        type: 'image/png' 
                    });
                } 
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: _json.item.name,
                    artist: _json.item.artists[0].name,
                    album: _json.item.album.name,
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
                            src: `/cover/${ getPlaylistOfCurrentTrack() }/${track.id}`,
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

const setVolume = (diff,newPercent=null) =>
{
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
            setSpotifyVolume(diff,newPercent);
            break;
        case LOCAL_SOURCE:
            setLocalVolume(diff,newPercent);
            break;
    }
}

const playNextTrack = async (player) =>
{
    // Otherwise play the next track from the history
    // and decrement the historyPos closer to the most recent track
    var nextTrackNum = null;
    var playlistName = null;

    if ( GLOBALS.historyPos == 0 )
    // If we are at (historyPos:0) play a new random track
    {
        source = audioSourceCoinflip();
        playlistName = getCurrentPlaylist(source);
    }
    else
    {
        playlistName = HISTORY[ GLOBALS.historyPos - 1 ].playlist;
        source = HISTORY[ GLOBALS.historyPos - 1 ].spotifyURI ? SPOTIFY_SOURCE : LOCAL_SOURCE;
        nextTrackNum = (getTrackHistoryJSON( --GLOBALS.historyPos )).trackNum ;
    }
    
    playTrackFromIndex(source, player, playlistName, nextTrackNum);
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
            playSpotifyTrack( prevTrack.playlist, player, prevTrack.trackNum, addToHistory=false);    
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
            playLocalTrack(prevTrack.playlist, prevTrack.trackNum, addToHistory=false);
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
            toggleSpotifyPlayback(getPlaylistOfCurrentTrack(), player);
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
    let p = null;

    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
            seekSpotifyPlayback( direction * CONFIG.seekStepMs);
            p = document.querySelector("#dummy");
            break;
        case LOCAL_SOURCE:
            p = document.querySelector("#localPlayer");
            break;
    }

    console.log( `Seek [start(),end()] = [${p.seekable.start(p.seekable.length - 1)},${p.seekable.end(p.seekable.length - 1)}] (sec)` );
    p.currentTime = p.currentTime + ( direction * (CONFIG.seekStepMs/1000) );

}

const playTrackFromIndex = (source, player, playlistName, trackNum) =>
{
    if ( document.querySelector("#pauseToggle").className == CONFIG.playClass && HISTORY.length > 0)
    // Check if the player is currently paused
    {
        // If the track that is about to be played is the same as the current track
        // and the player is paused, we resume playback instead of restarting it
        // (applicable for clicking a paused track in the playlists)
        
        _source = HISTORY[ GLOBALS.historyPos ].spotifyURI ? SPOTIFY_SOURCE : LOCAL_SOURCE;

        if (HISTORY[ GLOBALS.historyPos ].playlist == playlistName && 
            HISTORY[ GLOBALS.historyPos ].trackNum == trackNum &&
            _source == source )
        {
            pauseToggle(player);
        }
    }
    else
    {
        switch (source)
        {
            case SPOTIFY_SOURCE:
                document.querySelector("#localPlayer").pause();
                playSpotifyTrack( playlistName, player, trackNum );    
                break;
            case LOCAL_SOURCE:
                // Pause Spotify and start playing from the local source
                toggleSpotifyPlayback( getCurrentPlaylist(SPOTIFY_SOURCE) , player, pauseOnly=true );
                playNextLocalTrack(playlistName, trackNum);
                break; 
        }
    }
}

//********* UI **************//

const updateProgressIndicator = () =>
{
    var min = 0;
    var sec = 0;
    
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
            if ( GLOBALS.dummyProgressOffsetSec == -1) 
            {
                console.error(`dummyProgressOffset unset: Can't show track progress`); 
                return null;
            }

            // Javascript modulo does not convert negative numbers into positive values i.e.
            //  -40 % 60 ==> -40
            p = document.querySelector("#dummy");
            sec = Math.floor( ( ( (p.currentTime - GLOBALS.dummyProgressOffsetSec) % 60 ) + 60 ) % 60 );
            min = Math.floor(     (p.currentTime - GLOBALS.dummyProgressOffsetSec) / 60 );
            
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
    var trackName   = null;
    var artist      = null;
    var album       = null;
    switch(GLOBALS.currentSource)
    {
        case SPOTIFY_SOURCE:
                track       = (await getCurrentSpotifyTrack() ).item;
                trackName   = track.name || CONFIG.unknown;
                album       = track.album.name || CONFIG.unknown;
                artist      = track.artists[0].name || CONFIG.unknown;
            break;
        case LOCAL_SOURCE:
                track       = await getCurrentLocalTrack();
                trackName   = track.title || CONFIG.unknown;
                album       = track.album || CONFIG.unknown;
                artist      = track.artist || CONFIG.unknown;
            break;
    }
    
    rows = document.querySelectorAll("#trackList > tbody > tr");
    if (rows != [] && rows != null)
    {
        for (let row of rows)
        // Update the playlist UI to show the current track (if it exists in the UI)
        { 
            if ( row.querySelectorAll("td")[0].className.match( CONFIG.currentTrackCSS ) )
            // and remove the pulse effect from any other tracks
            {
                row.querySelectorAll("td")[0].className = 
                    row.querySelectorAll("td")[0].className.replace( CONFIG.currentTrackCSS, "" );
            }

            if( row.querySelectorAll("td")[1].innerText == trackName && 
            row.querySelectorAll("td")[2].innerText == album &&
            row.querySelectorAll("td")[3].innerText == artist  )
            {
                row.querySelectorAll("td")[0].className += ` ${CONFIG.currentTrackCSS}`;
            }
        }
    }

    document.querySelector("#currentTrack").innerText = trackName;
    document.querySelector("#currentSource").setAttribute("class", CONFIG.iconCSS[ GLOBALS.currentSource ] ); 
}

const addPlaylistTracksToUI = async (source, player) =>
// Run 'onchange' for <select> and in Init()
{
    var entry = {};
    var sec = null;
    rows = document.querySelectorAll("#trackList > tbody > tr");
    if (rows != [] && rows != null)
    {
        for (let row of rows)
        // Remove all tracks from the passed source before adding new entries
        { 
            if( row.querySelectorAll("td")[0].className.match(CONFIG.iconCSS[ source ]) )
            // Use the iconCSS to determine the source
            {
                row.remove();
            }
        }
    }

    var index = null;
    switch(source)
    {
        case SPOTIFY_SOURCE:
            index = 0;
            for (let _json of ((await getTracksJSON( getCurrentPlaylist(SPOTIFY_SOURCE) )) || []) )
            {
                sec = _json.track.duration_ms != null ? Math.floor(_json.track.duration_ms/1000) : 0;
                
                entry.title      = _json.track.name || CONFIG.unknown; 
                entry.album      = _json.track.album.name || CONFIG.unknown;
                entry.artist     = _json.track.artists[0].name || CONFIG.unknown;
                entry.duration   = `${Math.floor(sec/60)}:${sec%60 <= 9 ? '0'+Math.floor(sec%60) : Math.floor(sec%60)}`;

                addTrackToTable(source, player, entry, index++);
            }
            break;
        case LOCAL_SOURCE:
            index = 1;    
            for (let _json of ((await getLocalPlaylistJSON( getCurrentPlaylist(LOCAL_SOURCE) )) || {tracks: []}).tracks )
            {
                sec = _json.duration != null ? Math.floor(_json.duration) : 0;
                
                entry.title    = _json.title || CONFIG.unknown; 
                entry.album    = _json.album || CONFIG.unknown;
                entry.artist   = _json.artist || CONFIG.unknown;
                entry.duration = `${Math.floor(sec/60)}:${sec%60 <= 9 ? '0'+Math.floor(sec%60) : Math.floor(sec%60)}`;

                addTrackToTable(source, player, entry, index++);
            }
        break;
    }
}

const togglePauseTrackUI = (mode) =>
{
    rows = document.querySelectorAll("#trackList > tbody > tr");
    
    if (rows != [] && rows != null)
    {
        switch(mode)
        {
            case CONFIG.dummyPause:
                // Change the track with the currentTrackCSS to have a play icon when pausing playback
                    for (let row of rows)
                    { 
                        if ( row.querySelectorAll("td")[0].className.match( CONFIG.currentTrackCSS ) )
                        {
                            console.log("Adding playIcon!", row);
                            let _className  = row.querySelectorAll("td")[0].className
                            
                            _className      = _className.replace(CONFIG.currentTrackCSS, CONFIG.playClass);
                            
                            row.querySelectorAll("td")[0].className = _className;
                        }
                    }
                break;
            case CONFIG.dummyPlay:
                // Replace the playIcon with the currentTrackCSS when resuming playback
                for (let row of rows)
                { 
                    if ( row.querySelectorAll("td")[0].className.match( CONFIG.playClass ) )
                    {
                        console.log("Removing playIcon!", row);
                        let _className  = row.querySelectorAll("td")[0].className
                        _className      = _className.replace(CONFIG.playClass , CONFIG.currentTrackCSS);
                        row.querySelectorAll("td")[0].className = _className;
                    }
                }
                break;
        }
    }
}

//***** DUMMY PLAYER *******//

const updateDummyPlayerStatus = (mode) =>
// Start/Stop the dummy player and update the UI, if the source is NOT spotify
// we only update the UI
{
    togglePauseTrackUI(mode);
    
    switch(mode)
    {
        case CONFIG.dummyPause:
            if( GLOBALS.currentSource == SPOTIFY_SOURCE ){ document.querySelector("#dummy").pause(); }
            document.querySelector("#pauseToggle").setAttribute("class", CONFIG.playClass);
            break;
        case CONFIG.dummyPlay:
            if( GLOBALS.currentSource == SPOTIFY_SOURCE ) { document.querySelector("#dummy").play(); }
            document.querySelector("#pauseToggle").setAttribute("class", CONFIG.pauseClass);
            break;
    }
}

const setDummyProgressOffset = () =>
// We will update the progress indicator upon:
//  * A new spotify track being played
{
    GLOBALS.dummyProgressOffsetSec = document.querySelector("#dummy").currentTime; 
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
    
    for (let source of Object.keys( GLOBALS.currentPlaylistCount ) )
    // Ensure that each playlist has a count and sum up the total number of tracks
    {
        if ( GLOBALS.currentPlaylistCount[source] == null ) { updatePlaylistCount(source); }
        total_tracks += GLOBALS.currentPlaylistCount[source];
    }

    // The algorithm will give a fair disrubtion where every track has the same
    // likliehood to play (1/250 in the example below):
    
    // [0,199  ]   ==> spotify (200 tracks)
    // [200,250]   ==> local   (50 tracks)

    let outcome = Math.floor( Math.random() *  total_tracks )
    let _total = 0;
    
    for (let source of Object.keys( GLOBALS.currentPlaylistCount ) )
    {
        _total += GLOBALS.currentPlaylistCount[source];
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
    if ( getCurrentPlaylist(audioSource) == CONFIG.noContextOption )
    { 
        GLOBALS.currentPlaylistCount[audioSource] = 0; 
    }
    else
    {
        switch ( audioSource )
        {
            case SPOTIFY_SOURCE:
                let _json =  await getPlaylistJSON( getCurrentPlaylist(SPOTIFY_SOURCE));
                if (_json != null && _json != undefined)
                {
                    GLOBALS.currentPlaylistCount.spotify = _json.tracks.total; 
                }
                break;
            case LOCAL_SOURCE:
                await updateLocalPlaylistCount();
                break;
            default:
                console.error(`Unknown audioSource: ${audioSource}`);
        }

        if ( GLOBALS.currentPlaylistCount[audioSource] == null )
        { 
            console.error(`Failed to update ${audioSource} count`); 
        }
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

const addTrackToTable = (source, player, entry, index) =>
{
    row = document.createElement("tr");
    row.setAttribute("tabIndex", index);

    row.className = CONFIG.rowClass; 

    // Hook up each entry to play the indicated track when clicked
    row.onclick = () => playTrackFromIndex( source, player, getCurrentPlaylist(source), index ); 
    
    // Create a 3-item array of <td> elements
    columns = [...Array(CONFIG.tableColumns).keys()].map( () => document.createElement("td") );  
    
    // Set the class indicator for the spotify or local icon
    columns[0].setAttribute( "class", CONFIG.iconCSS[ source ] );
    
    columns[1].innerText = entry.title;
    columns[2].innerText = entry.album;
    columns[3].innerText = entry.artist;
    columns[4].innerText = entry.duration;

    for(let c of columns) { row.appendChild(c); }
    document.querySelector("#trackList > tbody").appendChild(row);
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

const getPlaylistOfCurrentTrack = () =>
{
    if ( HISTORY.length > GLOBALS.historyPos  )
    {
        return HISTORY[ GLOBALS.historyPos ].playlist;
    }
    else 
    { 
        console.error(`Not enough tracks in history to fetch ${GLOBALS.historyPos}`); 
    }
}

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
            if ( document.querySelector("#localPlaylist").length == 0 )
            {
                console.error("No local playlists loaded");
            }
            else { return document.querySelector("#localPlaylist").selectedOptions[0].innerText; }
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
