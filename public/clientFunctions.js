import { DEBUG, SPOTIFY_SOURCE, LOCAL_SOURCE, CONFIG } from './clientConfig.js';
import * as LocalFunctions from './localPlayerFunctions.js';
import * as SpotifyFunctions from './spotifyFunctions.js';

const setupMediaMetadata = async (STATE, HISTORY) =>
// Setup metadata for mediaSession
{
    switch(STATE.currentSource)
    {
        case SPOTIFY_SOURCE:
            let _json = null;
            try{ await SpotifyFunctions.getPlayerJSON(); }
            catch (e) { console.error(e); return; }

            let artwork = [];
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
            break;
        case LOCAL_SOURCE:
            let track = await getCurrentLocalTrack(HISTORY, STATE.historyPos);
            if (track != null)
            {
                let _playlist = null;
                try { _playlist = getPlaylistOfCurrentTrack(HISTORY,STATE.historyPos); }
                catch (e) { console.error(e); return; }

                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.title,
                    artist: track.artist,
                    album: track.album,
                    artwork: [
                        {
                            src: `/cover/${escape(_playlist)}/${track.id}`,
                            sizes: `${track.cover.width || 0}x${track.cover.height || 0}`,
                            type: `image/${track.cover.type || 'png'}`
                        }
                    ] 
                });

                document.querySelector("#cover").src = `/cover/${escape(_playlist)}/${track.id}`; 
            }
            else { console.error(`Failed to fetch metadata:`, track); }
            break;
    }
}

//******** AUDIO SOURCE MANAGMENT *********/

const setVolume = (source, diff, newPercent=null) =>
{
    switch(source)
    {
        case SPOTIFY_SOURCE:
            try { SpotifyFunctions.setSpotifyVolume(diff, newPercent); }
            catch (e) { console.error(e); }
            break;
        case LOCAL_SOURCE:
            LocalFunctions.setLocalVolume(diff,newPercent);
            break;
    }
}

const playNextTrack = async (STATE, HISTORY, spotifyPlayer, newPlaylist=false) =>
{
    // Otherwise play the next track from the history
    // and decrement the historyPos closer to the most recent track
    let addToHistory = true;

    let entry = {
        playlistName: null,
        source: null, 
        trackNum: null 
    };

    if ( STATE.historyPos == 0 )
    // If we are at (historyPos:0) play a new track
    {
        if(STATE.shuffle){ entry.source = audioSourceCoinflip(STATE.currentPlaylistCount); }
        else 
        // If shuffle is not active
        {
            setSourceAndTrackNumForNonShuffle(STATE, HISTORY, entry, newPlaylist);
        }
       
        let currentPlaylist = null;
        try { currentPlaylist = getCurrentPlaylist(entry.source); }
        catch (e) { console.error(e); return; }
        
        entry.playlistName = currentPlaylist;
    }
    else
    {
        entry.playlistName = HISTORY.arr[ STATE.historyPos - 1 ].playlist;
        entry.source = HISTORY.arr[ STATE.historyPos - 1 ].spotifyURI ? SPOTIFY_SOURCE : LOCAL_SOURCE;
        entry.trackNum = (getTrackHistoryJSON(HISTORY, STATE.historyPos - 1 )).trackNum;

        // Don't add a track to the HISTORY when catching up in the HISTORY
        addToHistory = false;
    }
    
    console.log("Next:", entry);
    playTrackFromIndex(STATE, HISTORY, entry.source, spotifyPlayer, entry.playlistName, entry.trackNum, addToHistory);
    
    // Decrement the history position after playing the next track
    if( STATE.historyPos != 0 ) STATE.historyPos--;
}

const playPrevTrack = async (STATE, HISTORY, spotifyPlayer) =>
{
    // The history keeps the most recent track at (index:0)
    // To rewind we therefore play the track at (historyPos + 1)
    // AND increment the historyPos

    // Current track ==> (index : historyPos)
    if ( STATE.historyPos + 1 < HISTORY.arr.length )
    {
        let prevTrack = getTrackHistoryJSON(HISTORY, ++STATE.historyPos );
        
        if (prevTrack.spotifyURI != null)
        // Play previous track from spotify
        {
            document.querySelector("#localPlayer").pause();    
            playSpotifyTrack(STATE, HISTORY, prevTrack.playlist, spotifyPlayer, prevTrack.trackNum, false);    
        }
        else if ( prevTrack.trackNum != null )
        // Play previous track from local storage
        {
            // Pause Spotify (should it be playing) and start playing from the local source
            await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
            });

            // To play the previous local track we simply pass the prevTrack ID
            playLocalTrack(STATE, HISTORY, prevTrack.playlist, prevTrack.trackNum, false);
        }
        else { console.error("Invalid previous track:", prevTrack); }
    }
    else { console.error(`No track in HISTORY to rewind to: (HISTORY.arr.length:${HISTORY.arr.length}, historyPos:${STATE.historyPos})`); return; }
}

const playTrackFromIndex = (STATE, HISTORY, source, spotifyPlayer, playlistName, trackNum, addToHistory=true) =>
{
    // If the track that is about to be played is the same as the current track
    // toggle playback instead of playing it from scratch, 
    // (applicable for clicking a paused track in the playlists)

    if ( HISTORY.arr.length > 0 )
    {
        let _source = HISTORY.arr[ STATE.historyPos ].spotifyURI ? SPOTIFY_SOURCE : LOCAL_SOURCE;

        if (HISTORY.arr[ STATE.historyPos ].playlist == playlistName && 
            HISTORY.arr[ STATE.historyPos ].trackNum == trackNum &&
            _source == source )
        {
            pauseToggle(STATE, HISTORY, spotifyPlayer);
            return;
        }
    }
    
    switch (source)
    {
        case SPOTIFY_SOURCE:
            document.querySelector("#localPlayer").pause();
            playSpotifyTrack(STATE, HISTORY, playlistName, spotifyPlayer, trackNum, addToHistory );    
            break;
        case LOCAL_SOURCE:
            // Pause Spotify and start playing from the local source
            let currentPlaylist = null;
            try { currentPlaylist = getCurrentPlaylist(SPOTIFY_SOURCE); }
            catch (e) { console.error(e); return; }

            toggleSpotifyPlayback(STATE, HISTORY, currentPlaylist, spotifyPlayer, true );
            playNextLocalTrack(STATE, HISTORY, playlistName, trackNum, addToHistory);
                break; 
    }
}

const pauseToggle = (STATE, HISTORY, spotifyPlayer) =>
{
    switch(STATE.currentSource)
    {
        case SPOTIFY_SOURCE:
            let _playlist = null;
            try { _playlist = getPlaylistOfCurrentTrack(HISTORY,STATE.historyPos); }
            catch (e) { console.error(e); return; }

            toggleSpotifyPlayback(STATE, HISTORY, _playlist, spotifyPlayer);
            break;
        case LOCAL_SOURCE:
            toggleLocalPlayback();
            break;
        default:
            // If no source is playing start the spotifyPlayer
            playNextTrack(STATE, HISTORY, spotifyPlayer);
    }
}

const seekPlayback = (source, direction) =>
{
    let p = null;

    switch(source)
    {
        case SPOTIFY_SOURCE:
            SpotifyFunctions.seekSpotifyPlayback( direction * CONFIG.seekStepMs);
            p = document.querySelector("#dummy");
            break;
        case LOCAL_SOURCE:
            p = document.querySelector("#localPlayer");
            break;
    }

    if(DEBUG) console.log( `Seek [start(),end()] = [${p.seekable.start(p.seekable.length - 1)},${p.seekable.end(p.seekable.length - 1)}] (sec)` );
    
    p.currentTime = p.currentTime + ( direction * (CONFIG.seekStepMs/1000) );

}

//********* Spotify **********/

const addPlayerListeners = (STATE, HISTORY, spotifyPlayer) =>
{
    // See https://developer.spotify.com/documentation/web-playback-sdk/quick-start/
    // Error handling
    const errors = ['initialization_error', 'authentication_error', 'account_error', 'playback_error'];
    errors.forEach( (item) => 
    {
        spotifyPlayer.addListener(item, ({message}) => console.error(`${item}:`, message)  );
    });

    // Playback status updates
    spotifyPlayer.addListener('player_state_changed', state => 
    { 
        if(DEBUG) console.log('player_state_changed', state); 
        handleSpotifyTrackEnd(STATE, HISTORY, spotifyPlayer);
    });

    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }) => 
    { 
        console.log('Ready with Device ID', device_id);
        (async ()=>
        {
            await SpotifyFunctions.InitSpotifyPlayer(spotifyPlayer);

            // Add the tracks from the playlist to the UI
            addPlaylistTracksToUI(STATE, HISTORY, SPOTIFY_SOURCE, spotifyPlayer);

            // Update the playlist track counter
            updatePlaylistCount(STATE, SPOTIFY_SOURCE);
        })();
    });

    // Not Ready
    spotifyPlayer.addListener('not_ready', ({ device_id }) => { console.log('Device ID has gone offline', device_id); });
}

const handleSpotifyTrackEnd = async (STATE, HISTORY, spotifyPlayer) =>
{
    if ( STATE.currentSource == SPOTIFY_SOURCE )
    {
        let track = await SpotifyFunctions.getCurrentSpotifyTrack();
    
        if ( track.item.uri == CONFIG.spotifySilence )
        // Check if we are currently listening to 'silence'
        {
            if(DEBUG) console.log(`Listening to: ${track.item.name}`);
            
            if ( STATE.mutexTaken == false)
            // Ensure that no other 'player_state_change' event is in the
            // process of starting a new track
            {
                STATE.mutexTaken = true;
                if(DEBUG) console.log("Mutex taken!");

                playNextTrack(STATE, HISTORY, spotifyPlayer);

                // Short wait before releasing the mutex
                await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
                STATE.mutexTaken = false;
                if(DEBUG) console.log("Mutex released!");
            }
        }
    }

} 

const toggleSpotifyPlayback = async (STATE, HISTORY, playlistName, spotifyPlayer, pauseOnly=false) => 
{
    //*** NOTE that one cannot directly ['index'] the return value from an async function */
    let _json = null;
    try  { _json = await SpotifyFunctions.getDeviceJSON(); }
    catch (e) { console.error(e); return; }

    if (!_json['is_active'])
    // If the spotifyPlayer is not active start it
    {
        if (!pauseOnly)
        {
            await playSpotifyTrack(STATE, HISTORY, playlistName, spotifyPlayer);
        }
    }
    else
    {
        let _json = null;
        try{ await SpotifyFunctions.getPlayerJSON(); }
        catch (e) { console.error(e); return; }

        if (_json['is_playing'])
        {
            await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
            });
            updateDummyPlayerStatus(STATE.currentSource, CONFIG.dummyPause);
        }
        else
        {
            if(!pauseOnly)
            {
                await fetch(`https://api.spotify.com/v1/me/player/play`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
                });
                updateDummyPlayerStatus(STATE.currentSource, CONFIG.dummyPlay);
            }
        }
    }
}

const playSpotifyTrack = async (STATE, HISTORY, playlistName, spotifyPlayer, trackNum=null, addToHistory=true) => 
// Start playback with a random track from the provided playlist followed by silence
// If a prevIndex from HISTORY is provided the corresponding track from the playlist will be chosen
{
    STATE.currentSource = SPOTIFY_SOURCE;

    let track = null;
    let tracks_json   = await getTracksJSON(STATE, playlistName);
    if (tracks_json == null){ console.error(`Failed to fetch tracks for ${playlistName}`); return null; }

    
    if ( trackNum == null )
    /* (historyPos:0) ==> Play a new track */
    {
        // NOTE that we decrement the trackNum to get the array index in tracks_json
        trackNum = getNewTrackNumber(HISTORY, STATE.currentSource, STATE.currentPlaylistCount.spotify );
   
        // If we are playing a new track we should add it to the HISTORY
        // but we should also add explicitly played tracks to the HISTORY         
    }
    
    if(DEBUG) console.log(`Playing new track=${trackNum} tracks_json[${trackNum}] (addToHistory=${addToHistory}):`, tracks_json);

    // NOTE that we add the trackNum++ to the HISTORY since it is 
    if (addToHistory){ addTrackToHistory(HISTORY, SPOTIFY_SOURCE, trackNum, tracks_json[trackNum].track.uri); }

    /* (historyPos >= 1) ==> Play next track in HISTORY */
    // The next track is guaranteed to be a Spotify track from the base selection in `playPrevTrack()`
    // and is passed as an argument
    
    track     = tracks_json[trackNum].track; 
    
    if(DEBUG) console.log(`Track JSON for ${track.name}:`, trackNum, track);

    // Start playback 
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyPlayer._options.id}`, {
        method: 'PUT',
        body: JSON.stringify( { uris: [ track.uri, CONFIG.spotifySilence ] } ),
        //body: JSON.stringify({ context_uri: (await getPlaylistJSON(playlistName)).uri }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}`
        },
    });

    // Fetch the current track (after a short delay)
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
    updateCurrentTrackUI(HISTORY, STATE.historyPos, STATE.currentSource);

    // Start the dummy spotifyPlayer and set a value for the dummyProgressOffset
    updateDummyPlayerStatus(STATE.currentSource, CONFIG.dummyPlay);
    setDummyProgressOffset(STATE);

    // Set a value for the duration on the progress bar
    let sec = Math.floor(( track.duration_ms /1000)%60);
    if (sec <= 9 && sec >= 0){ sec = `0${sec}`; }
    
    STATE.currentDuration = 
    {
        sec: sec,
        min: Math.floor((track.duration_ms/1000)/60) 
    } 

    // Update the volume indicator (relevant after a switch from the localPlayer)
    document.querySelector("#volume").innerText = `${ Math.floor( (await SpotifyFunctions.getPlayerJSON()).device.volume_percent ) } %`;

    // Setup media Session metadata
    setupMediaMetadata(STATE, HISTORY);
}

const getTracksJSON = async (STATE, playlistName) =>
{
    let playlist_json = null;
    try { playlist_json = await SpotifyFunctions.getPlaylistJSON(playlistName); }
    catch (e) { console.error(e); return; }

    let currentPlaylist = null;
    try { currentPlaylist = getCurrentPlaylist(SPOTIFY_SOURCE); }
    catch (e) { console.error(e); return; }
    
    // The API only allows for 100 tracks to be returned per request, we must therefore issue several fetches
    // to aquire all the tracks of a playlist
    if ( STATE.currentPlaylistCount.spotify == null && currentPlaylist == playlistName )
    { 
        updatePlaylistCount(STATE, SPOTIFY_SOURCE); 
    }
    let tracks = [];
    
    while ( tracks.length < playlist_json.tracks.total )
    {
        let res = await fetch(`https://api.spotify.com/v1/playlists/${playlist_json.id}/tracks?offset=${tracks.length}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
        });

        try 
        { 
            let body = await res.text();
            tracks = tracks.concat( JSON.parse(body)['items'] );  
        }
        catch (e) { console.error(e); return; }
    }

    return tracks;
}

//********** Local player *********/

const playNextLocalTrack = (STATE, HISTORY, playlistName, trackNum=null, addToHistory=true) => 
{
    STATE.currentSource = LOCAL_SOURCE; 
   
    // When picking the track to play we ensure that no track from the history is picked
    // if all tracks have been played, clear the history

    if (trackNum == null)
    /* (historyPos:0) ==> Play a new track (and add it to the HISTORY) */
    {
        trackNum = getNewTrackNumber(HISTORY, STATE.currentSource, STATE.currentPlaylistCount.local );
    }

    if(addToHistory){ addTrackToHistory(HISTORY, LOCAL_SOURCE, trackNum); }

    // Play the given track
    playLocalTrack(STATE, HISTORY, playlistName, trackNum);
}

const playLocalTrack = async (STATE, HISTORY, playlistName, trackNum) =>
{
    document.querySelector("#localPlayer").src = `/audio/${escape(playlistName)}/${trackNum}`
    let p = document.querySelector("#localPlayer");
    await p.load();
    await p.play();
   
    // Short wait before setting the currentDuration and updating the UI
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));

    let sec = Math.floor(document.querySelector("#localPlayer").duration % 60);
    if (sec <= 9 && sec >= 0){ sec = `0${sec}`; }

    STATE.currentDuration = 
    {
        sec: sec,
        min: Math.floor(document.querySelector("#localPlayer").duration / 60)
    }

    updateDummyPlayerStatus(STATE.currentSource, CONFIG.dummyPlay);
    await updateCurrentTrackUI(HISTORY, STATE.historyPos, STATE.currentSource);

    // Update volume indicator
    LocalFunctions.setLocalVolume(0);

    setupMediaMetadata(STATE, HISTORY);
}

const toggleLocalPlayback = () =>
{
    let p = document.querySelector("#localPlayer");
    if (p.paused) { p.play();  updateDummyPlayerStatus(LOCAL_SOURCE, CONFIG.dummyPlay);  }
    else          { p.pause(); updateDummyPlayerStatus(LOCAL_SOURCE, CONFIG.dummyPause); }
}

const getCurrentLocalTrack = async (HISTORY, historyPos) =>
{
    let playlist = null;
    try 
    {
        playlist = await LocalFunctions.
            getLocalPlaylistJSON(getPlaylistOfCurrentTrack(HISTORY, historyPos));
    }
    catch (e) { console.error(e); return null; }


    let trackNum = getTrackHistoryJSON(HISTORY, historyPos).trackNum;
    try
    {
        return playlist.tracks[trackNum];
    }
    catch (e) { console.error(e); return null; }
}

const updateLocalPlaylistCount = async (STATE) =>
{
    let playlist = null;
    try 
    { 
        playlist = await LocalFunctions
            .getLocalPlaylistJSON(getCurrentPlaylist(LOCAL_SOURCE));
    }
    catch (e) { console.error(e); return; }
    
    STATE.currentPlaylistCount.local = playlist.tracks.length; 
}

//********* Media keys *******/

const mediaPlay = async (source) =>
{
    switch(source)
    {
        case SPOTIFY_SOURCE:
            // Wait a bit for the spotify spotifyPlayer state to update (via the reaction from the iframe) 
            // before checking it
            await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
            
            let _json = null;
            try { _json = await SpotifyFunctions.getPlayerJSON(); }
            catch (e) { console.error(e); return; }

            if ( _json['is_playing'] === false )
            // If the spotify spotifyPlayer is not playing, start it
            {
                await fetch(`https://api.spotify.com/v1/me/player/play`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
                });
            }
            updateDummyPlayerStatus(SPOTIFY_SOURCE, CONFIG.dummyPlay);
            break;
        case LOCAL_SOURCE:
            toggleLocalPlayback(LOCAL_SOURCE);
            break;
    }
}

const mediaPause = async (source) =>
{
    switch(source)
    {
        case SPOTIFY_SOURCE:
            // Wait a bit for the spotify spotifyPlayer state to update before checking it
            await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));

            let _json = null;
            try { _json = await SpotifyFunctions.getPlayerJSON(); }
            catch (e) { console.error(e); return; }

            if ( _json['is_playing'] === true )
            // If the spotify spotifyPlayer is playing, pause it
            {
                await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
                });
            }
            updateDummyPlayerStatus(SPOTIFY_SOURCE, CONFIG.dummyPause);
            break;
        case LOCAL_SOURCE:
            toggleLocalPlayback();
            break;
    }
}

//********* UI **************//

const updateProgressIndicator = (STATE) =>
{
    let min = 0;
    let sec = 0;
    let p   = null;
    
    switch(STATE.currentSource)
    {
        case SPOTIFY_SOURCE:
            if ( STATE.dummyProgressOffsetSec == -1) { throw(`dummyProgressOffset unset: Can't show track progress`); } 

            // Javascript modulo does not convert negative numbers into positive values i.e.
            //  -40 % 60 ==> -40
            p = document.querySelector("#dummy");
            sec = Math.floor( ( ( (p.currentTime - STATE.dummyProgressOffsetSec) % 60 ) + 60 ) % 60 );
            min = Math.floor(     (p.currentTime - STATE.dummyProgressOffsetSec) / 60 );
            
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
   
    if ( STATE.currentDuration.sec == -1) { throw(`currentDuration unset: Can't show track progress`); }
    
    try
    {
        document.querySelector("#progress").innerText = 
            `${min}:${sec} / ${STATE.currentDuration.min}:${STATE.currentDuration.sec}`; 
    }
    catch (e) { console.error(e, min,sec, STATE.currentDuration.min, STATE.currentDuration.sec); }


}

const updateCurrentTrackUI = async (HISTORY, historyPos, source) =>
{
    let track       = null;
    let trackName   = null;
    let artist      = null;
    let album       = null;
    switch(source)
    {
        case SPOTIFY_SOURCE:
                try { track = (await SpotifyFunctions.getCurrentSpotifyTrack() ).item; }
                catch (e) { console.error(e); return }
                trackName   = track.name || CONFIG.unknown;
                album       = track.album.name || CONFIG.unknown;
                artist      = track.artists[0].name || CONFIG.unknown;
            break;
        case LOCAL_SOURCE:
                try { track = await getCurrentLocalTrack(HISTORY, historyPos); }
                catch (e) { console.error(e); return; }
                trackName   = track.title || CONFIG.unknown;
                album       = track.album || CONFIG.unknown;
                artist      = track.artist || CONFIG.unknown;
            break;
    }
    
    let rows = document.querySelectorAll("#trackList > tbody > tr");
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
    document.querySelector("#currentSource").setAttribute("class", CONFIG.iconCSS[source] ); 
}

const addPlaylistTracksToUI = async (STATE, HISTORY, source, spotifyPlayer) =>
// Run 'onchange' for <select> and in Init()
{
    let entry = {};
    let sec = null;
    let rows = document.querySelectorAll("#trackList > tbody > tr");
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

    let currentPlaylist = null;
    try { currentPlaylist = getCurrentPlaylist(source); }
    catch (e) { console.error(e); return; }

    let index = 0;
    switch(source)
    {
        case SPOTIFY_SOURCE:
            for (let _json of ((await getTracksJSON(STATE, currentPlaylist)) || []) )
            {
                sec = _json.track.duration_ms != null ? Math.floor(_json.track.duration_ms/1000) : 0;
                
                entry.title      = _json.track.name || CONFIG.unknown; 
                entry.album      = _json.track.album.name || CONFIG.unknown;
                entry.artist     = _json.track.artists[0].name || CONFIG.unknown;
                entry.duration   = `${Math.floor(sec/60)}:${sec%60 <= 9 ? '0'+Math.floor(sec%60) : Math.floor(sec%60)}`;

                addTrackToTable(STATE, HISTORY, source, spotifyPlayer, entry, index++);
            }
            break;
        case LOCAL_SOURCE:

            let tracks = null;
            try { tracks = (await LocalFunctions.getLocalPlaylistJSON(currentPlaylist)).tracks; }
            catch (e) { console.error(e); return; }

            for (let _json of tracks)
            {
                sec = _json.duration != null ? Math.floor(_json.duration) : 0;
                
                entry.title    = _json.title || CONFIG.unknown; 
                entry.album    = _json.album || CONFIG.unknown;
                entry.artist   = _json.artist || CONFIG.unknown;
                entry.duration = `${Math.floor(sec/60)}:${sec%60 <= 9 ? '0'+Math.floor(sec%60) : Math.floor(sec%60)}`;

                addTrackToTable(STATE, HISTORY, source, spotifyPlayer, entry, index++);
            }
        break;
    }
}

const togglePauseTrackUI = (mode) =>
{
    let rows = document.querySelectorAll("#trackList > tbody > tr");
    
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

const updateDummyPlayerStatus = (source, mode) =>
// Start/Stop the dummy spotifyPlayer and update the UI, if the source is NOT spotify
// we only update the UI
{
    togglePauseTrackUI(mode);
    
    switch(mode)
    {
        case CONFIG.dummyPause:
            if( source == SPOTIFY_SOURCE ){ document.querySelector("#dummy").pause(); }
            document.querySelector("#pauseToggle").setAttribute("class", CONFIG.playClass);
            break;
        case CONFIG.dummyPlay:
            if( source == SPOTIFY_SOURCE ) { document.querySelector("#dummy").play(); }
            document.querySelector("#pauseToggle").setAttribute("class", CONFIG.pauseClass);
            break;
    }
}

const setDummyProgressOffset = (STATE) =>
// We will update the progress indicator upon:
//  * A new spotify track being played
{
    STATE.dummyProgressOffsetSec = document.querySelector("#dummy").currentTime; 
}

const dummyAudioHandler = (mode) =>
// Activated when the pause/play media keys are pressed
{
    navigator.mediaSession.playbackState = mode;  
    if(DEBUG) console.log(mode,event);
    event.stopPropagation();
}

//********** HELPER *******//

const audioSourceCoinflip = ( currentPlaylistCount ) =>
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
    let currentPlaylists = { [SPOTIFY_SOURCE]: null, [LOCAL_SOURCE]: null };
    try 
    { 
        currentPlaylists[SPOTIFY_SOURCE] = getCurrentPlaylist(SPOTIFY_SOURCE); 
        currentPlaylists[LOCAL_SOURCE]   = getCurrentPlaylist(LOCAL_SOURCE); 
    }
    catch (e) { console.error(e); return; }

    if ( currentPlaylists[SPOTIFY_SOURCE] == CONFIG.noContextOption ){ return LOCAL_SOURCE; }
    if ( currentPlaylists[LOCAL_SOURCE]   == CONFIG.noContextOption ){ return SPOTIFY_SOURCE; }

    let total_tracks = 0;
    
    for (let source of Object.keys( currentPlaylistCount ) )
    // Each source should have a count when this function is invoked
    {
        total_tracks += currentPlaylistCount[source];
    }

    // The algorithm will give a fair disrubtion where every track has the same
    // likliehood to play (1/250 in the example below):
    
    // [0,199  ]   ==> spotify (200 tracks)
    // [200,250]   ==> local   (50 tracks)

    let outcome = Math.floor( Math.random() *  total_tracks )
    let _total = 0;
    
    for (let source of Object.keys( currentPlaylistCount ) )
    {
        _total += currentPlaylistCount[source];
        if ( outcome <= _total ) { return source; }
    }
}

const getTrackHistoryJSON = (HISTORY, index=0) =>
// Returns a track from the HISTORY
//  index=0 ==> currently playing
//  index=1 ==> previous track
// and verfies that it contains the neccessary information
{
    if (HISTORY.arr.length > index)
    { 
        if ( HISTORY.arr[index].trackNum == null )
        { 
            console.error(`No trackNum information for: ${HISTORY.arr[index]}`); 
        }
        return HISTORY.arr[index];
    }
    else
    { 
        console.error(`HISTORY does not have enough entries to fetch [${index}]:`, HISTORY); 
        return {playlist: null, trackNum: null, spotifyURI: null}; 
    }
}

const updatePlaylistCount = async (STATE, source) =>
{
    let currentPlaylist = null;
    try { currentPlaylist = getCurrentPlaylist(source); }
    catch (e) { console.error(e); return; }
    
    if ( currentPlaylist == CONFIG.noContextOption )
    { 
        STATE.currentPlaylistCount[source] = 0; 
    }
    else
    {
        switch (source)
        {
            case SPOTIFY_SOURCE:
                let _json =  await SpotifyFunctions.getPlaylistJSON( currentSource );
                if (_json != null && _json != undefined)
                {
                    STATE.currentPlaylistCount.spotify = _json.tracks.total; 
                }
                break;
            case LOCAL_SOURCE:
                await updateLocalPlaylistCount(STATE);
                break;
            default:
                console.error(`Unknown source: ${source}`);
        }

        if ( STATE.currentPlaylistCount[source] == null )
        { 
            console.error(`Failed to update ${source} count`); 
        }
    }
}

const addTrackToHistory = (HISTORY, source, trackNum,uri=null) => 
{
    while (HISTORY.arr.length >= CONFIG.historyLimit) { HISTORY.arr.pop(); }
    
    let currentPlaylist = null;
    try { currentPlaylist = getCurrentPlaylist(source); }
    catch (e) { console.error(e); return; }
    
    HISTORY.arr = [ 
        {
            playlist: currentPlaylist,
            trackNum: trackNum,
            spotifyURI: uri
        }
    ].concat(HISTORY.arr);
}

const addTrackToTable = (STATE, HISTORY, source, spotifyPlayer, entry, index) =>
{
    let row = document.createElement("tr");
    row.setAttribute("tabIndex", index);

    row.className = CONFIG.rowClass; 

    let currentPlaylist = null;
    try { currentPlaylist = getCurrentPlaylist(source); }
    catch (e) { console.error(e); return; }

    // Hook up each entry to play the indicated track when clicked (starting from index=1)
    row.onclick = () => playTrackFromIndex(STATE, HISTORY, source, spotifyPlayer, currentPlaylist, index ); 
    
    // Create a 3-item array of <td> elements
    let columns = [...Array(CONFIG.tableColumns).keys()].map( () => document.createElement("td") );  
    
    // Set the class indicator for the spotify or local icon
    columns[0].setAttribute( "class", CONFIG.iconCSS[ source ] );
    
    columns[1].innerText = entry.title;
    columns[2].innerText = entry.album;
    columns[3].innerText = entry.artist;
    columns[4].innerText = entry.duration;

    for(let c of columns) { row.appendChild(c); }
    document.querySelector("#trackList > tbody").appendChild(row);
}

const getNewTrackNumber = (HISTORY, source, playlistLength, trackNum=null) =>
// The track numbers start from **0**
{
    let currentPlaylist = null;
    try { currentPlaylist = getCurrentPlaylist(source); }
    catch (e) { console.error(e, source, currentPlaylist); return -1; }
    
    // If all tracks in the playlist exist in the history, clear the history
    if ( HISTORY.arr.filter( h => h.playlist == currentPlaylist ).length == playlistLength )
    {
        HISTORY.arr = [];
    }

    while( HISTORY.arr.filter( h => h.playlist == currentPlaylist )
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

const toggleShuffle = (STATE) =>
{
    STATE.shuffle = !STATE.shuffle;
    if(STATE.shuffle)
    {
        document.querySelector("#shuffleToggle").className = 
            document.querySelector("#shuffleToggle").className.replace( CONFIG.noShuffleClass, CONFIG.shuffleClass );
    } 
    else 
    {
        document.querySelector("#shuffleToggle").className =
            document.querySelector("#shuffleToggle").className.replace( CONFIG.shuffleClass, CONFIG.noShuffleClass );
    }
}

//********* MISC *********//

const setSourceAndTrackNumForNonShuffle = (STATE, HISTORY, ref , newPlaylist) =>
{
    if (newPlaylist != false)
    // If the track to play is from a new playlist, play the first track
    {
        ref.source   = newPlaylist;
        ref.trackNum = 0;
    }
    else
    {
        if ( HISTORY.arr.length > 0 )
        // If shuffle is not active we can identify the next track to play from the trackNum of
        // the current track in the HISTORY, if the trackNum is the last in the playlist we attempt
        // to play the first track from the other source (if one exists) and otherwise start over from 0
        {
            if ( HISTORY.arr[ STATE.historyPos ].trackNum == STATE.currentPlaylistCount[STATE.currentSource] - 1 )
            // If the current track is the last in the playlist
            {
                let _otherSource = STATE.currentSource == SPOTIFY_SOURCE ? LOCAL_SOURCE : SPOTIFY_SOURCE;
                
                let otherSourcePlaylist = null;
                try { otherSourcePlaylist = getCurrentPlaylist(_otherSource); }
                catch (e) { console.error(e); return; }

                if ( otherSourcePlaylist != CONFIG.noContextOption )
                // If there is a playlist setup for the other source, play the first track from the other source
                {
                    ref.source       = _otherSource;
                }
                else 
                { 
                    ref.source       = STATE.currentSource; 
                }

                ref.trackNum = 0;
            }
            else
            {
                if(DEBUG) console.log(`(trackNum:${ref.trackNum}) = (HISTORY[${STATE.historyPos}].trackNum:${HISTORY.arr[STATE.historyPos].trackNum}) + 1`)
                ref.trackNum     = HISTORY.arr[STATE.historyPos].trackNum + 1;
                ref.source       = STATE.currentSource;
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

const getPlaylistOfCurrentTrack = (HISTORY,historyPos) =>
{
    if ( HISTORY.arr.length > historyPos  )
    {
        return HISTORY.arr[ historyPos ].playlist;
    }
    else {  throw(`Not enough tracks in history to fetch ${historyPos}`); }
}

const getCurrentPlaylist = (source) =>
{
    switch(source)
    {
        case SPOTIFY_SOURCE:
            if ( document.querySelector("#spotifyPlaylist").length == 0 )
            {
                throw("No Spotify playlists loaded in <select> element");
            }
            else { return document.querySelector("#spotifyPlaylist").selectedOptions[0].innerText; }
        case LOCAL_SOURCE:
            if ( document.querySelector("#localPlaylist").length == 0 )
            {
                throw("No local playlists loaded in <select> element");
            }
            else { return document.querySelector("#localPlaylist").selectedOptions[0].innerText; }
        default:
            throw("getCurrentPlaylist() called with an invalid argument!", source);
    }
}

const getDebug = (STATE,HISTORY) =>
{
    console.log("DEBUG:",STATE,HISTORY);
}

//********** EXPORTS ******************/
export {
    // client.js
    addPlayerListeners, updateProgressIndicator, addPlaylistTracksToUI, dummyAudioHandler, 
    updatePlaylistCount, getCurrentPlaylist, 

    // controls.js
    setVolume, playPrevTrack, pauseToggle, seekPlayback, toggleShuffle, mediaPlay, mediaPause, 
    modifyVisibility, getDebug,
    
    // control.js + client.js
    playNextTrack 
}
