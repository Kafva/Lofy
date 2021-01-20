// Top level dispatch functions from client.js
// Changes to STATE.currentSource are done in:
//      * playSpotifyTrack()
//      * playLocalTrack()

import { DEBUG, SPOTIFY_SOURCE, LOCAL_SOURCE, LOCAL_ONLY, CONFIG } from './clientConfig.js';
import * as LocalFunctions   from './localPlayerFunctions.js';
import * as SpotifyFunctions from './spotifyFunctions.js';
import * as Util             from './util.js';

const setupMediaMetadata = async (STATE, HISTORY) =>
// Setup metadata for mediaSession
{
    switch(STATE.currentSource)
    {
        case SPOTIFY_SOURCE:
            let _json = null;
            try { _json = await SpotifyFunctions.getPlayerJSON(); }
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
                try { _playlist = Util.getPlaylistOfCurrentTrack(HISTORY,STATE.historyPos); }
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

//******** AUDIO SOURCE MANAGMENT **********//

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
        if(STATE.shuffle){ entry.source = Util.audioSourceCoinflip(STATE.currentPlaylistCount,spotifyPlayer); }
        else 
        // If shuffle is not active
        {
            Util.setSourceAndTrackNumForNonShuffle(STATE, HISTORY, entry, newPlaylist, spotifyPlayer);
        }
       
        let currentPlaylist = null;
        try { currentPlaylist = Util.getCurrentPlaylist(entry.source); }
        catch (e) { console.error(e); return; }
        
        entry.playlistName = currentPlaylist;
    }
    else
    {
        entry.playlistName = HISTORY.arr[ STATE.historyPos - 1 ].playlist;
        entry.source = HISTORY.arr[ STATE.historyPos - 1 ].spotifyURI ? SPOTIFY_SOURCE : LOCAL_SOURCE;
        entry.trackNum = (Util.getTrackHistoryJSON(HISTORY, STATE.historyPos - 1 )).trackNum;

        // Don't add a track to the HISTORY when catching up in the HISTORY
        addToHistory = false;
    }
    
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
        let prevTrack = Util.getTrackHistoryJSON(HISTORY, ++STATE.historyPos );
        
        let _source = prevTrack.spotifyURI != null ? SPOTIFY_SOURCE : LOCAL_SOURCE;
        playTrackFromIndex(STATE, HISTORY, _source, spotifyPlayer, prevTrack.playlist, prevTrack.trackNum, false, true); 
    }
    else { console.error(`No track in HISTORY to rewind to: (HISTORY.arr.length:${HISTORY.arr.length}, historyPos:${STATE.historyPos})`); return; }
}

const playTrackFromIndex = (STATE, HISTORY, source, spotifyPlayer, playlistName, trackNum, addToHistory=true, rewinding=false, pruneHistory=false) =>
{

    if(DEBUG) console.log(`About to play: ${source}:${playlistName}:${trackNum} (currently @ historyPos=${STATE.historyPos})`);
    
    if (!rewinding)
    {
        if ( HISTORY.arr.length > 0 )
        // If the track that is about to be played is the same as the current track
        // toggle playback instead of playing it from scratch, 
        // (applicable for clicking a paused track in the playlists)
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
    }

    if (pruneHistory)
    // NOTE that when we enter here from the playlistUI we could be at a historyPos > 0, if that is
    // the case we want to delete the future HISTORY entries up until the new track at HISTORY.arr[0]
    // and reset our position to historyPos=0
    {
        while ( STATE.historyPos > 0 ) 
        { 
            // Removes the item at index=1 (in-place)
            try 
            { 
                if(DEBUG) console.log(`Pruning ${HISTORY.arr[1].playlist}:${HISTORY.arr[1].trackNum} from HISTORY`);
                HISTORY.arr.splice(1,1); 
            }
            catch (e) { console.error(e); break; }
            STATE.historyPos--;
        }    
    }


    switch (source)
    {
        case SPOTIFY_SOURCE:
            // Pause the local player and start playing from Spotify
            document.querySelector("#localPlayer").pause();
            playSpotifyTrack(STATE, HISTORY, playlistName, spotifyPlayer, trackNum, addToHistory );    
            break;
        case LOCAL_SOURCE:
            // Pause Spotify and start playing from the local source (if not in LOCAL_ONLY mode)
            let currentPlaylist = null;
            
            if (spotifyPlayer != LOCAL_ONLY)
            {
                try { currentPlaylist = Util.getCurrentPlaylist(SPOTIFY_SOURCE); }
                catch (e) { console.error(e); return; }
                toggleSpotifyPlayback(STATE, HISTORY, currentPlaylist, spotifyPlayer, true, false);
            }

            playLocalTrack(STATE, HISTORY, playlistName, trackNum, addToHistory);
            break; 
    }
}

const pauseToggle = (STATE, HISTORY, spotifyPlayer) =>
{
    switch(STATE.currentSource)
    {
        case SPOTIFY_SOURCE:
            let _playlist = null;
            try { _playlist = Util.getPlaylistOfCurrentTrack(HISTORY,STATE.historyPos); }
            catch (e) { console.error(e); return; }
            toggleSpotifyPlayback(STATE, HISTORY, _playlist, spotifyPlayer);
            break;
        case LOCAL_SOURCE:
            Util.toggleLocalPlayback();
            break;
        default:
            // If no source is playing start the spotifyPlayer
            playNextTrack(STATE, HISTORY, spotifyPlayer);
    }
}

//********* Spotify ***********//

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

            let currentPlaylist = null;
            try { currentPlaylist = Util.getCurrentPlaylist(SPOTIFY_SOURCE); }
            catch(e) { console.error(e); return; }
            
            if ( currentPlaylist != CONFIG.noContextOption )
            {
                // Add the tracks from the playlist to the UI (if a playlist selected)
                addPlaylistTracksToUI(STATE, HISTORY, SPOTIFY_SOURCE, spotifyPlayer);
            }
            
            // Update the playlist track counter
            Util.updatePlaylistCount(STATE, SPOTIFY_SOURCE, currentPlaylist);
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

const toggleSpotifyPlayback = async (STATE, HISTORY, playlistName, spotifyPlayer, pauseOnly=false, updateUI=true) => 
// When we call toggleSpotifyPlayback the '|>' button is added on pausing
// we call this when switching sources, we thus need to add a flag which indicates that we
// don't want to update the UI when we know we are switching sources
{
    
    //*** NOTE that one cannot directly ['index'] the return value from an async function **//
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
        try { _json = await SpotifyFunctions.getPlayerJSON(); }
        catch (e) { console.error(e); return; }
        
        if (_json['is_playing'])
        {
            await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
            });
            
            if(updateUI) Util.togglePauseForUI(CONFIG.pause);
            SpotifyFunctions.toggleDummyPlayerStatusForSpotify(CONFIG.pause);
        }
        else
        {
            if(!pauseOnly)
            {
                await fetch(`https://api.spotify.com/v1/me/player/play`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${SpotifyFunctions.getCookiesAsJSON().access_token}` },
                });
                
                if(updateUI) Util.togglePauseForUI(CONFIG.play);
                SpotifyFunctions.toggleDummyPlayerStatusForSpotify(CONFIG.play);
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
    let tracks_json   = await getSpotifyTracksJSON(STATE, playlistName);
    if (tracks_json == null){ console.error(`Failed to fetch tracks for ${playlistName}`); return null; }

    
    if ( trackNum == null )
    /* (historyPos:0) ==> Play a new track **/
    {
        // NOTE that we decrement the trackNum to get the array index in tracks_json
        trackNum = Util.getNewTrackNumber(HISTORY, STATE.currentSource, STATE.currentPlaylistCount.spotify );
   
        // If we are playing a new track we should add it to the HISTORY
        // but we should also add explicitly played tracks to the HISTORY         
    }
    
    if(DEBUG) console.log(`Playing new track=${trackNum} tracks_json[${trackNum}] (addToHistory=${addToHistory}):`, tracks_json);

    // NOTE that we add the trackNum++ to the HISTORY since it is 
    if (addToHistory){ Util.addTrackToHistory(HISTORY, SPOTIFY_SOURCE, trackNum, tracks_json[trackNum].track.uri); }

    /* (historyPos >= 1) ==> Play next track in HISTORY **/
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

    // Short delay before continuing
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
    
    // Update the volume indicator (relevant after a switch from the localPlayer)
    document.querySelector("#volume").innerText = `${ Math.floor( (await SpotifyFunctions.getPlayerJSON()).device.volume_percent ) } %`;

    // Start the dummy-spotifyPlayer and update the Bar UI's playbutton
    // The playlist UI won't be paused so it won't be updated 
    Util.togglePauseForUI(CONFIG.play);
    SpotifyFunctions.toggleDummyPlayerStatusForSpotify(CONFIG.play);
    
    // Update the dummyProgress offset
    STATE.dummyProgressOffsetSec = document.querySelector("#dummy").currentTime; 
    
    // Set a value for the duration on the progress bar
    let sec = Math.floor(( track.duration_ms /1000)%60);
    if (sec <= 9 && sec >= 0){ sec = `0${sec}`; }
    
    STATE.currentDuration = 
    {
        sec: sec,
        min: Math.floor((track.duration_ms/1000)/60) 
    } 

    // Add the Amp icon and track name to the bar
    try { await updateCurrentTrackInBarAndPlaylist(HISTORY, STATE.historyPos, STATE.currentSource); }
    catch(e){ console.error(e); }

    // Setup media Session metadata
    setupMediaMetadata(STATE, HISTORY);
}

const getSpotifyTracksJSON = async (STATE, playlistName) =>
{
    let playlist_json = null;
    try { playlist_json = await SpotifyFunctions.getPlaylistJSON(playlistName); }
    catch (e) { console.error(e); return; }

    let currentPlaylist = null;
    try { currentPlaylist = Util.getCurrentPlaylist(SPOTIFY_SOURCE); }
    catch (e) { console.error(e); return; }
    
    // The API only allows for 100 tracks to be returned per request, we must therefore issue several fetches
    // to aquire all the tracks of a playlist
    if ( STATE.currentPlaylistCount.spotify == null && currentPlaylist == playlistName )
    { 
        Util.updatePlaylistCount(STATE, SPOTIFY_SOURCE, currentPlaylist); 
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

//********** Local player **********//

const playLocalTrack = async (STATE, HISTORY, playlistName, trackNum=null, addToHistory=true) => 
{
    STATE.currentSource = LOCAL_SOURCE; 
   
    // When picking the track to play we ensure that no track from the history is picked
    // if all tracks have been played, clear the history

    if (trackNum == null)
    /* (historyPos:0) ==> Play a new track (and add it to the HISTORY) **/
    {
        trackNum = Util.getNewTrackNumber(HISTORY, STATE.currentSource, STATE.currentPlaylistCount.local );
    }

    if(addToHistory){ Util.addTrackToHistory(HISTORY, LOCAL_SOURCE, trackNum); }

    // Set the source of the audio object
    document.querySelector("#localPlayer").src = `/audio/${escape(playlistName)}/${trackNum}`
    let p = document.querySelector("#localPlayer");
    await p.load();
    await p.play();
   
    // Short wait before setting the currentDuration and updating the UI
    // some 'timeupdate' events will thus be sent before the currentDuration etc. is set
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));

    let sec = Math.floor(document.querySelector("#localPlayer").duration % 60);
    if (sec <= 9 && sec >= 0){ sec = `0${sec}`; }

    STATE.currentDuration = 
    {
        sec: sec,
        min: Math.floor(document.querySelector("#localPlayer").duration / 60)
    }
    
    // Update volume indicator
    LocalFunctions.setLocalVolume(0);

    // When starting the player from scratch we need to update the Bar UI
    Util.togglePauseForUI(CONFIG.play);
    
    // Add the Amp icon and track name to the bar
    try { await updateCurrentTrackInBarAndPlaylist(HISTORY, STATE.historyPos, STATE.currentSource); }
    catch(e){ console.error(e); }

    setupMediaMetadata(STATE, HISTORY);
}

const getCurrentLocalTrack = async (HISTORY, historyPos) =>
{
    console.log(`HISTORY[${historyPos}] = ${HISTORY.arr[historyPos].playlist}:${HISTORY.arr[historyPos].trackNum}`);
    
    let playlist = null;
    try 
    {
        playlist = await LocalFunctions.
            getLocalPlaylistJSON(Util.getPlaylistOfCurrentTrack(HISTORY, historyPos));
    }
    catch (e) { console.error(e); return null; }

    let trackNum = Util.getTrackHistoryJSON(HISTORY, historyPos).trackNum;
    try
    {
        return playlist.tracks[trackNum];
    }
    catch (e) { console.error(e); return null; }
}

//********** Time-update events **********/

const timeUpdateHandler = async (STATE) =>
// Only ran on 'timeupdate' events to the #dummy or #localPlayer
// if the event is triggered before the dummyProgressOffset and/or duration is
// initalised we enter a waiting state
{
    let min = 0;
    let sec = 0;
    let p   = null;
    
    switch(STATE.currentSource)
    {
        case SPOTIFY_SOURCE:
            while ( STATE.dummyProgressOffsetSec == -1) 
            { 
                await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
                if(DEBUG) console.log(`dummyProgressOffset unset: Can't show track progress (${STATE.currentSource})`); 
            } 

            // Javascript modulo does not convert negative numbers into positive values i.e.
            //  -40 % 60 ==> -40
            p = document.querySelector("#dummy");
            sec = Math.floor( ( ( (p.currentTime - STATE.dummyProgressOffsetSec) % 60 ) + 60 ) % 60 );
            min = Math.floor(     (p.currentTime - STATE.dummyProgressOffsetSec) / 60 );
            
            if (sec <= 9){ sec = `0${sec}`; }
            break;
        case LOCAL_SOURCE:
            p = document.querySelector("#localPlayer");
            sec = Math.floor(p.currentTime % 60);
            min = Math.floor(p.currentTime / 60);

            if (sec <= 9){ sec = `0${sec}`; }
            break;
    }
   
    while ( STATE.currentDuration.sec == -1) 
    { 
        await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
        if(DEBUG) console.log(`currentDuration unset: Can't show track progress (${STATE.currentSource})`); 
    }
    
    try
    {
        document.querySelector("#progress").innerText = 
            `${min}:${sec} / ${STATE.currentDuration.min}:${STATE.currentDuration.sec}`; 
    }
    catch (e) { console.error(e, min,sec, STATE.currentDuration.min, STATE.currentDuration.sec); }


}

//****** Current track (Bar + Playlist) ******//

const updateCurrentTrackInBarAndPlaylist = async (HISTORY, historyPos, source) =>
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
   
    if(DEBUG) console.log( track, historyPos, source );
    let rows = document.querySelectorAll("#trackList > tbody > tr");
    if (rows != [] && rows != null)
    {
        for (let row of rows)
        // Update the playlist UI to show the current track (if it exists in the UI)
        { 
            if ( row.querySelectorAll("td")[0].className.match( CONFIG.currentTrackCSS ) )
            // and remove the pulse effect from any other tracks
            {
                if (DEBUG) console.log(`Replacing ${CONFIG.currentTrackCSS} from ${row.querySelectorAll("td")[1].innerHTML}`);
                row.querySelectorAll("td")[0].className = 
                    row.querySelectorAll("td")[0].className.replace( CONFIG.currentTrackCSS, "" );
            }

            if( row.querySelectorAll("td")[1].innerHTML == trackName && 
            row.querySelectorAll("td")[2].innerHTML == album &&
            row.querySelectorAll("td")[3].innerHTML == artist  )
            // Note the usage of .innerHTML instead of .innerText, changing visibility will apperently also
            // hide the .innerText and therefore we use .innerHTML
            {
                if (DEBUG) console.log(`Adding ${CONFIG.currentTrackCSS} to ${row.querySelectorAll("td")[1].innerHTML}`);
                row.querySelectorAll("td")[0].className += ` ${CONFIG.currentTrackCSS}`;
            }
        }
    }
    else { throw(`Failed to fetch playlist rows`); }

    document.querySelector("#currentTrack").innerText = trackName;
    document.querySelector("#currentSource").setAttribute("class", CONFIG.iconCSS[source] ); 
}

//********* Init Playlist UI **************//

const addPlaylistTracksToUI = async (STATE, HISTORY, source, spotifyPlayer) =>
// Run 'onchange' for <select> and in 'ready' listener
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
    try { currentPlaylist = Util.getCurrentPlaylist(source); }
    catch (e) { console.error(e); return; }

    let index = 0;
    switch(source)
    {
        case SPOTIFY_SOURCE:
            for (let _json of ((await getSpotifyTracksJSON(STATE, currentPlaylist)) || []) )
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

const addTrackToTable = (STATE, HISTORY, source, spotifyPlayer, entry, index) =>
{
    let row = document.createElement("tr");
    row.setAttribute("tabIndex", index);

    row.className = CONFIG.rowClass; 

    let currentPlaylist = null;
    try { currentPlaylist = Util.getCurrentPlaylist(source); }
    catch (e) { console.error(e); return; }

    // Hook up each entry to play the indicated track when clicked (starting from index=1)
    row.onclick = () => playTrackFromIndex(STATE, HISTORY, source, spotifyPlayer, currentPlaylist, index, true, false, true); 
    
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

export {
    addPlayerListeners, timeUpdateHandler, addPlaylistTracksToUI,

    playPrevTrack, pauseToggle, playNextTrack 
}