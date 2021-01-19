import { CONFIG } from './clientConfig.js'

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
    let res  = await fetch("/playlists");
    let body = await res.text();
    let playlists = JSON.parse(body);

    if (name != null)
    {
        let playlistIndex = playlists.findIndex( p => p.name == name );
        if (playlistIndex >= 0)
        {
            return playlists[playlistIndex];
        }
        else { throw `Could not find playlist: ${name}`; }
    }
    else { return playlists; }
}

const setLocalPlaylistOptions = async () =>
{
    let playlists = null;
    try { playlists = await getLocalPlaylistJSON(); }
    catch (e) { console.error(e); return; }
    
    // Default option when no context is found
    let opt = document.createElement("option"); 
    opt.innerText = CONFIG.noContextOption;
    document.querySelector("#localPlaylist").add(opt);

    for (let playlist of playlists)
    {
        let opt = document.createElement("option"); 
        opt.innerText = playlist.name;
        if ( opt.innerText == CONFIG.defaultLocalPlaylist ){ opt.setAttribute("selected",""); }
        document.querySelector("#localPlaylist").add(opt);
    }
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

export { 
    //client.js + clientFunctions.js
    setLocalVolume,
    
    // clientFunctions.js
    getLocalPlaylistJSON,
    
    // client.js
    setLocalPlaylistOptions,
};