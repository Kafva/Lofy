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

                    if ( item.width == CONFIG.coverWidth && item.height == CONFIG.coverHeight )
                    {
                        document.querySelector("#cover").src = item.url;
                    }
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
                            src: `/cover/${ escape(getPlaylistOfCurrentTrack()) }/${track.id}`,
                            sizes: `${track.cover.width || 0}x${track.cover.height || 0}`,
                            type: `image/${track.cover.type || 'png'}`
                        }
                    ] 
                });

                document.querySelector("#cover").src = `/cover/${ escape(getPlaylistOfCurrentTrack()) }/${track.id}`; 
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

const playNextTrack = async (player, newPlaylist=false) =>
{
    // Otherwise play the next track from the history
    // and decrement the historyPos closer to the most recent track
    let addToHistory = true;

    let entry = {
        playlistName: null,
        source: null, 
        trackNum: null 
    };

    if ( GLOBALS.historyPos == 0 )
    // If we are at (historyPos:0) play a new track
    {
        if(GLOBALS.shuffle){ entry.source = audioSourceCoinflip(); }
        else 
        // If shuffle is not active
        {
            setSourceAndTrackNumForNonShuffle(entry, newPlaylist);
        }
        
        entry.playlistName = getCurrentPlaylist(entry.source);
    }
    else
    {
        entry.playlistName = HISTORY[ GLOBALS.historyPos - 1 ].playlist;
        entry.source = HISTORY[ GLOBALS.historyPos - 1 ].spotifyURI ? SPOTIFY_SOURCE : LOCAL_SOURCE;
        entry.trackNum = (getTrackHistoryJSON( GLOBALS.historyPos - 1 )).trackNum;

        // Don't add a track to the HISTORY when catching up in the HISTORY
        addToHistory = false;
    }
    
    console.log("Next:", entry);
    playTrackFromIndex(entry.source, player, entry.playlistName, entry.trackNum, addToHistory);
    
    // Decrement the history position after playing the next track
    if( GLOBALS.historyPos != 0 ) GLOBALS.historyPos--;
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

    if(DEBUG) console.log( `Seek [start(),end()] = [${p.seekable.start(p.seekable.length - 1)},${p.seekable.end(p.seekable.length - 1)}] (sec)` );
    
    p.currentTime = p.currentTime + ( direction * (CONFIG.seekStepMs/1000) );

}

const playTrackFromIndex = (source, player, playlistName, trackNum, addToHistory=true) =>
{
    // If the track that is about to be played is the same as the current track
    // toggle playback instead of playing it from scratch, 
    // (applicable for clicking a paused track in the playlists)

    if ( HISTORY.length > 0 )
    {
        _source = HISTORY[ GLOBALS.historyPos ].spotifyURI ? SPOTIFY_SOURCE : LOCAL_SOURCE;

        if (HISTORY[ GLOBALS.historyPos ].playlist == playlistName && 
            HISTORY[ GLOBALS.historyPos ].trackNum == trackNum &&
            _source == source )
        {
            pauseToggle(player);
            return;
        }
    }
    
    switch (source)
    {
        case SPOTIFY_SOURCE:
            document.querySelector("#localPlayer").pause();
            playSpotifyTrack( playlistName, player, trackNum, addToHistory );    
            break;
        case LOCAL_SOURCE:
            // Pause Spotify and start playing from the local source
            toggleSpotifyPlayback( getCurrentPlaylist(SPOTIFY_SOURCE) , player, pauseOnly=true );
            playNextLocalTrack(playlistName, trackNum, addToHistory);
                break; 
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

    var index = 0;
    switch(source)
    {
        case SPOTIFY_SOURCE:
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
                            if(DEBUG) console.log("Adding playIcon!", row);
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
                        if (DEBUG) console.log("Removing playIcon!", row);
                        let _className  = row.querySelectorAll("td")[0].className
                        _className      = _className.replace(CONFIG.playClass , CONFIG.currentTrackCSS);
                        row.querySelectorAll("td")[0].className = _className;
                    }
                }
                break;
        }
    }
}

const modifyVisibility = async (selector, visibleOpacity=1, checkSrc=false) =>
{
    if ( getComputedStyle(document.querySelector(selector)).opacity == 0 )
    // Make visible
    {
        // Move the item into the flexbox
        let el =  document.querySelector(selector);
        document.querySelector("#container").append(el);
        
        if(checkSrc)
        {
            if ( document.querySelector(selector).src != "" )
            {
                document.querySelector(selector).style.visibility = 'visible'; 
                document.querySelector(selector).style.opacity = visibleOpacity; 
            }  
        }
        else 
        { 
            document.querySelector(selector).style.visibility = 'visible'; 
            document.querySelector(selector).style.opacity = visibleOpacity; 
        }
    }
    else
    // Make invisible
    {
        // We haft to wait before setting the visibility for the animation to complete
        document.querySelector(selector).style.opacity = 0; 
        await new Promise(r => setTimeout(r, 500));
        document.querySelector(selector).style.visibility = 'hidden'; 


        // Move the item out of the flexbox
        let el =  document.querySelector(selector);
        document.body.append(el);
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
        console.error(`HISTORY does not have enough entries to fetch [${index}]:`, HISTORY); 
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

    // Hook up each entry to play the indicated track when clicked (starting from index=1)
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
// The track numbers start from **0**
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
        // We multiply by [length]
        // Example: length = 16
        //  ( random([0,1]) * 16 )
        //  ==> [0,15]
        trackNum  = Math.floor( Math.random() * (playlistLength) );
    }

    if(DEBUG) console.log(`Random trackNum = ${trackNum} = floor(rand(0,1) * ${playlistLength}`);
    return trackNum;
}

const dummyAudioHandler = (mode) =>
// Activated when the pause/play media keys are pressed
{
    navigator.mediaSession.playbackState = mode;  
    if(DEBUG) console.log(mode,event);
    event.stopPropagation();
}

const toggleShuffle = () =>
{
    GLOBALS.shuffle = !GLOBALS.shuffle;
    if(GLOBALS.shuffle) document.querySelector("#shuffleToggle").style['border-color'] = CONFIG.textColor; 
    else document.querySelector("#shuffleToggle").style['border-color'] = 'rgba(0,0,0,0)';
}

//********* MISC *********//

const setSourceAndTrackNumForNonShuffle = ( ref , newPlaylist) =>
{
    if (newPlaylist != false)
    // If the track to play is from a new playlist, play the first track
    {
        ref.source   = newPlaylist;
        ref.trackNum = 0;
    }
    else
    {
        if ( HISTORY.length > 0 )
        // If shuffle is not active we can identify the next track to play from the trackNum of
        // the current track in the HISTORY, if the trackNum is the last in the playlist we attempt
        // to play the first track from the other source (if one exists) and otherwise start over from 0
        {
            if ( HISTORY[ GLOBALS.historyPos ].trackNum == GLOBALS.currentPlaylistCount[GLOBALS.currentSource] - 1 )
            // If the current track is the last in the playlist
            {
                let _otherSource = GLOBALS.currentSource == SPOTIFY_SOURCE ? LOCAL_SOURCE : SPOTIFY_SOURCE;

                if ( getCurrentPlaylist(_otherSource) != CONFIG.noContextOption )
                // If there is a playlist setup for the other source, play the first track from the other source
                {
                    ref.source       = _otherSource;
                }
                else 
                { 
                    ref.source       = GLOBALS.currentSource; 
                }

                ref.trackNum = 0;
            }
            else
            {
                if(DEBUG) console.log(`(trackNum:${ref.trackNum}) = (HISTORY[${GLOBALS.historyPos}].trackNum:${HISTORY[GLOBALS.historyPos].trackNum}) + 1`)
                ref.trackNum     = HISTORY[GLOBALS.historyPos].trackNum + 1;
                ref.source       = GLOBALS.currentSource;
            }
        }
        else
        // If the HISTORY is empty play the first track from the source indicated by the
        // top of the playlist UI
        {  
            ref.trackNum     = 0;
            ref.source       = document.querySelector("#trackList > tbody > tr > td").className.match( CONFIG.iconCSS[SPOTIFY_SOURCE] ) ?
                SPOTIFY_SOURCE : LOCAL_SOURCE; 
        }
    }
}

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
