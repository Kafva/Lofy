
const keyboardHandler = (event, player) => 
{
    if(DEBUG) console.log(`-------- ${event.key} | (shift:${event.shiftKey}) ----------`)   

    if (!event.shiftKey)
    // Key bindings not requiring shift
    {
        switch( event.key )
        {
            case CONFIG.scrollUp:
                window.scroll(0 , window.scrollY - CONFIG.scrollPixels);
                break;
            case CONFIG.scrollDown:
                window.scroll(0 , window.scrollY + CONFIG.scrollPixels);
                break;
            case CONFIG.scrollTop:
                window.scrollTo(0,0);
                break;
            case CONFIG.pausePlay:
                // Prevent <SPACE> from scrolling
                event.preventDefault();
                pauseToggle(player);
                break;
        }
    }
    else 
    {
        switch(event.key)
        {
            case CONFIG.volumeUp:
                setVolume(CONFIG.volumeStep);
                break;
            case CONFIG.volumeDown:
                setVolume(-CONFIG.volumeStep);
                break;
            case CONFIG.next:
                playNextTrack(player);
                break;
            case CONFIG.previous:
                playPrevTrack(player);
                break;
            case CONFIG.seekForward:
                seekPlayback(1);
                break;
            case CONFIG.seekBack:
                seekPlayback(-1);
                break;
            case CONFIG.scrollBottom:
                window.scrollTo(0,document.querySelector("#trackList").scrollHeight);
                break;
        }
    }
}

const mediaHandlers = (player) =>
{
    if ('mediaSession' in navigator) 
    {
        navigator.mediaSession.setActionHandler(CONFIG.dummyPlay, async () => 
        { 
            if(DEBUG) console.log(`----PLAY---- (${navigator.mediaSession.playbackState})`); 
            
            switch(GLOBALS.currentSource)
            {
                case SPOTIFY_SOURCE:
                    // Wait a bit for the spotify player state to update (via the reaction from the iframe) 
                    // before checking it
                    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));
                    
                    let _json = await getPlayerJSON();

                    if ( _json['is_playing'] === false )
                    // If the spotify player is not playing, start it
                    {
                        await fetch(`https://api.spotify.com/v1/me/player/play`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                        });
                    }
                    updateDummyPlayerStatus(CONFIG.dummyPlay);
                    break;
                case LOCAL_SOURCE:
                    toggleLocalPlayback();
                    break;
            }
        });
        navigator.mediaSession.setActionHandler(CONFIG.dummyPause, async () => 
        { 
            if(DEBUG) console.log(`----PAUSE---- (${navigator.mediaSession.playbackState})`); 
           
            switch(GLOBALS.currentSource)
            {
                case SPOTIFY_SOURCE:
                    // Wait a bit for the spotify player state to update before checking it
                    await new Promise(r => setTimeout(r, CONFIG.newTrackDelay));

                    let _json = await getPlayerJSON();

                    if ( _json['is_playing'] === true )
                    // If the spotify player is playing, pause it
                    {
                        await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${getCookiesAsJSON().access_token}` },
                        });
                    }
                    updateDummyPlayerStatus(CONFIG.dummyPause);
                    break;
                case LOCAL_SOURCE:
                    toggleLocalPlayback();
                    break;
            }
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => 
        { 
            if(DEBUG) console.log("----PREV----");
            playPrevTrack(player);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => 
        { 
            if(DEBUG) console.log("----NEXT-----"); 
            playNextTrack(player);
        });
    }
}

const clickHandler = (player) =>
{

    switch (event.target.id)
    {
        case 'playlistToggle':
            modifyVisibility("#trackList");
            break;
        case 'coverToggle':
            modifyVisibility("#cover", CONFIG.coverOpacity, checkSrc=true);
            break;
        case 'pauseToggle':
            pauseToggle(player);    
            break;
        case 'volumeUp':
            setVolume(CONFIG.volumeStep);
            break;
        case 'volumeDown':
            setVolume(-CONFIG.volumeStep);
            break;
        case 'previous':
            playPrevTrack(player);
            break;
        case 'next':
            playNextTrack(player);
            break;
        case 'seekForward':
            seekPlayback(1);
            break;
        case 'seekBack':
            seekPlayback(-1);
            break;
    }
}

