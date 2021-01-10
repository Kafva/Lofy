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
    opt.innerText = CONSTS.noContextOption;
    document.querySelector("#localPlaylist").add(opt);

    for (playlist of playlists)
    {
        let opt = document.createElement("option"); 
        opt.innerText = playlist.name;
        if ( opt.innerText == CONSTS.defaultLocalPlaylist ){ opt.setAttribute("selected",""); }
        document.querySelector("#localPlaylist").add(opt);
    }
}

const InitLocalPlayer = () =>
{
    let p = document.querySelector("#localPlayer");
    p.volume = CONSTS.defaultPercent / 100;
    
    updatePlaylistCount(LOCAL_SOURCE);
}

const playTrack = async (trackNum) => 
{
    if (trackNum == undefined)
    // Play a random track if no number is provided
    {
        while ( trackNum == GLOBALS.prevNum.local || trackNum == undefined)
        // Avoid fetching the same track twice in a row
        {
            trackNum  = Math.floor( Math.random() * (GLOBALS.playlistCount.local-1) ) + 1;
        }
    }
    
    document.querySelector("#localSource").src = `/audio/${CONSTS.audioSources.local.getCurrentPlaylist()}/${trackNum}`
    let p = document.querySelector("#localPlayer")
    await p.load();
    p.play();

    GLOBALS.currentSource = LOCAL_SOURCE;
    GLOBALS.prevNum.local = trackNum;
}

//********** HELPER **********/

const updateLocalPlaylistCount = async () =>
{
    playlists = await getLocalPlaylistJSON(); 
    
    for (let playlist of playlists)
    {
        if ( playlist.name == CONSTS.audioSources.local.getCurrentPlaylist() )
        // Find the playlist corresponding to the current selection
        {
            GLOBALS.playlistCount.local = playlist.tracks.length; 
            break;
        }
    }
}
