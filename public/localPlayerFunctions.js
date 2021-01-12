//******** LOCAL FILES **********/
// Local playlists are defined using text files under ./playlists/<...>.txt with
// each line containing the path to a sound file (anywhere on the server)

// The client can fetch track audio from /audio/<playlist>/<trackNum>
// And metadata for each playlist (and all tracks within it) via /playlists

const getLocalPlaylistJSON = async (name) =>
{
    // [ { 
    //     name: <...>, 
    //     count: <...> 
    //     tracks: [
    //         {
    //             id: <...>,
    //             title: <...>,
    //             artist: <...>,
    //             album: <...>,
    //             duration: <...>
    //             cover:
    //             {
    //                  width: <...>
    //                  height: <...>
    //                  type: <...>    
    //             }
    //         }
    //     ]
    //   }, ... 
    // ]
    res  = await fetch("/playlists");
    body = await res.text();
    
    playlists = JSON.parse(body);

    if (name != null)
    {
        playlistIndex = playlists.findIndex( p => p.name == name );
        if (playlistIndex >= 0)
        {
            return playlists[playlistIndex];
        }
        else { return null; }
    }
    else { return playlists; }
}

const setLocalPlaylistOptions = async () =>
{
    playlists = await getLocalPlaylistJSON();
    
    // Default option when no context is found
    let opt = document.createElement("option"); 
    opt.innerText = CONFIG.noContextOption;
    document.querySelector("#localPlaylist").add(opt);

    for (playlist of playlists)
    {
        let opt = document.createElement("option"); 
        opt.innerText = playlist.name;
        if ( opt.innerText == CONFIG.defaultLocalPlaylist ){ opt.setAttribute("selected",""); }
        document.querySelector("#localPlaylist").add(opt);
    }
}

const InitLocalPlayer = () =>
{
    let p = document.querySelector("#localPlayer");
    p.volume = CONFIG.defaultPercent / 100;
    
    updatePlaylistCount(LOCAL_SOURCE);
}

const playNextLocalTrack = (trackNum=null) => 
{
    // When picking the track to play we ensure that no track from the history is picked
    // if all tracks have been played, clear the history

    if (trackNum == null)
    /* (historyPos:0) ==> Play a new track (and add it to the HISTORY) */
    {
        trackNum = getNewTrackNumber( GLOBALS.playlistCount.local );

        addTrackToHistory(LOCAL_SOURCE, trackNum);
    }

    // Play the given track
    playLocalTrack(trackNum)
}

const getCurrentLocalTrack = async () =>
{
    let playlist = await getLocalPlaylistJSON( getCurrentPlaylist(LOCAL_SOURCE) );
    if (playlist != undefined && playlist != [])
    {
        trackNum = getTrackHistoryJSON( GLOBALS.historyPos ).trackNum;
        try
        {
            return playlist.tracks[trackNum - 1];
        }
        catch (e) { console.error(e); return null; }
    }
    else { console.error(`getCurrentLocalTrack(): getLocalPlaylistJSON ==> ${playlists}`); }

}

const toggleLocalPlayback = () =>
{
    let p = document.querySelector("#localPlayer");
    if (p.paused) { p.play();  updateDummyPlayerStatus('play');  }
    else          { p.pause(); updateDummyPlayerStatus('pause'); }
}

//********** HELPER **********/

const playLocalTrack = async (trackNum) =>
{
    document.querySelector("#localSource").src = `/audio/${getCurrentPlaylist(LOCAL_SOURCE)}/${trackNum}`
    let p = document.querySelector("#localPlayer");
    await p.load();
    await p.play();
   
    // Short wait before setting the currentDuration and updating the UI
    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));

    let sec = Math.floor(document.querySelector("#localPlayer").duration % 60);
    if (sec <= 9 && sec >= 0){ sec = `0${sec}`; }

    GLOBALS.currentDuration = 
    {
        sec: sec,
        min: Math.floor(document.querySelector("#localPlayer").duration / 60)
    }

    updateDummyPlayerStatus('play');
    updateCurrentTrackUI();
    setupMediaMetadata();
}

const updateLocalPlaylistCount = async () =>
{
    playlists = await getLocalPlaylistJSON(); 
    
    for (let playlist of playlists)
    {
        if ( playlist.name == getCurrentPlaylist(LOCAL_SOURCE) )
        // Find the playlist corresponding to the current selection
        {
            GLOBALS.playlistCount.local = playlist.tracks.length; 
            break;
        }
    }
}
