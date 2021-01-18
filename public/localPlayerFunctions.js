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

const playNextLocalTrack = (STATE, HISTORY, playlistName, trackNum=null, addToHistory=true) => 
{
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

const getCurrentLocalTrack = async (HISTORY, historyPos) =>
{
    let _playlist = getPlaylistOfCurrentTrack(HISTORY, historyPos);
    let playlist = await getLocalPlaylistJSON( _playlist );
    if (playlist != undefined && playlist != [])
    {
        trackNum = getTrackHistoryJSON(HISTORY, historyPos ).trackNum;
        try
        {
            return playlist.tracks[trackNum];
        }
        catch (e) { console.error(e); return null; }
    }
    else { console.error("getCurrentLocalTrack(): getLocalPlaylistJSON ==>", _playlist, playlist); }

}

const toggleLocalPlayback = () =>
{
    let p = document.querySelector("#localPlayer");
    if (p.paused) { p.play();  updateDummyPlayerStatus(LOCAL_SOURCE, CONFIG.dummyPlay);  }
    else          { p.pause(); updateDummyPlayerStatus(LOCAL_SOURCE, CONFIG.dummyPause); }
}

const setLocalVolume = (diff, newPercent=null) =>
// diff and newPercent are given as [0,100]
{
    if (newPercent == null)
    { 
        newPercent = document.querySelector("#localPlayer").volume + (diff/100); 
    }
    else { newPercent = newPercent / 100; }
    
    document.querySelector("#localPlayer").volume = newPercent; 
   
    // Update the UI
    document.querySelector("#volume").innerText = `${Math.floor(newPercent*100)} %`;
}

//********** HELPER **********/

const playLocalTrack = async (STATE, HISTORY, playlistName, trackNum) =>
{
    STATE.currentSource = LOCAL_SOURCE; 
    
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
    updateCurrentTrackUI(HISTORY, STATE.historyPos, STATE.currentSource);

    // Update volume indicator
    setLocalVolume(0);

    setupMediaMetadata(STATE, HISTORY);
}

const updateLocalPlaylistCount = async (STATE) =>
{
    playlists = await getLocalPlaylistJSON(); 
    
    for (let playlist of playlists)
    {
        if ( playlist.name == getCurrentPlaylist(LOCAL_SOURCE) )
        // Find the playlist corresponding to the current selection
        {
            STATE.currentPlaylistCount.local = playlist.tracks.length; 
            return;
        }
    }
}
