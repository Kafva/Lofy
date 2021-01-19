import { DEBUG, SPOTIFY_SOURCE, LOCAL_SOURCE, CONFIG } from './clientConfig.js';
import * as LocalFunctions   from './localPlayerFunctions.js';
import * as SpotifyFunctions from './spotifyFunctions.js';

//************ UI ****************/

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

const modifyVisibility = async (selector, visibleOpacity=1, checkSrc=false, insertBefore=false) =>
{
    if ( getComputedStyle(document.querySelector(selector)).opacity == 0 )
    // Make visible
    {
        // Move the item into the flexbox
        let el =  document.querySelector(selector);
        if (insertBefore) 
        { 
            let child = document.querySelector("#container > *");
            if( child != null)
            {  
                document.querySelector("#container").insertBefore(el, child);
            }
            else { document.querySelector("#container").append(el); }
             
        }
        else { document.querySelector("#container").append(el); }
        
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

//************ Dummy audio ********/

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

const dummyAudioHandler = (mode) =>
// Activated when the pause/play media keys are pressed
{
    navigator.mediaSession.playbackState = mode;  
    if(DEBUG) console.log(mode,event);
    event.stopPropagation();
}


//********** Audio Control ************//

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

//********* Media keys *******/

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

//********** HISTORY **************/

const getNewTrackNumber = (HISTORY, source, playlistLength, trackNum=null) =>
// The track numbers start from **0**
// May reset the HISTORY
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

//********** Shuffle **********/

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

//******* Playlist count ************/

const updatePlaylistCount = async (STATE, source, currentPlaylist) =>
{
    if ( currentPlaylist == CONFIG.noContextOption )
    { 
        STATE.currentPlaylistCount[source] = 0; 
    }
    else
    {
        switch (source)
        {
            case SPOTIFY_SOURCE:
                let _json =  await SpotifyFunctions.getPlaylistJSON( currentPlaylist );
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

//********** MISC *****************/

const audioSourceCoinflip = (currentPlaylistCount) =>
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
            throw("getCurrentPlaylist() called with an invalid argument!");
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

export { 
    // controls.js
    modifyVisibility, mediaPlay, mediaPause, seekPlayback, setVolume, toggleShuffle,

    // stateFunctions.js
    updateDummyPlayerStatus, getCurrentPlaylist, getPlaylistOfCurrentTrack, audioSourceCoinflip, 
    getTrackHistoryJSON, addTrackToHistory, setSourceAndTrackNumForNonShuffle, getNewTrackNumber, 
    updatePlaylistCount,
   
    // client.js
    dummyAudioHandler
}