
const keyboardHandler = (STATE, HISTORY, player, event) => 
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
                pauseToggle(STATE, HISTORY, player);
                break;
        }
    }
    else 
    {
        switch(event.key)
        {
            case CONFIG.debugInfo:
                getDebug(STATE,HISTORY);
                break;
            case CONFIG.volumeUp:
                setVolume(STATE.currentSource, CONFIG.volumeStep);
                break;
            case CONFIG.volumeDown:
                setVolume(STATE.currentSource,-CONFIG.volumeStep);
                break;
            case CONFIG.next:
                playNextTrack(STATE, HISTORY, player);
                break;
            case CONFIG.previous:
                playPrevTrack(STATE, HISTORY, player);
                break;
            case CONFIG.seekForward:
                seekPlayback(STATE.currentSource, 1);
                break;
            case CONFIG.seekBack:
                seekPlayback(STATE.currentSource, -1);
                break;
            case CONFIG.scrollBottom:
                window.scrollTo(0,document.querySelector("#trackList").scrollHeight);
                break;
        }
    }
}

//**** MEDIA KEYS *****/
// The spotify <iframe> contains the actual web player and its own mediaSession object which we can't access due to SOP
// https://github.com/spotify/web-playback-sdk/issues/105
// https://stackoverflow.com/questions/25098021/securityerror-blocked-a-frame-with-origin-from-accessing-a-cross-origin-frame

// As a work-around we use a dummy <audio> object which we register `ActionHandlers` for,
// the spotify iframe will still catch <PAUSE> events but our own dummy object will be notified
// as well when this occurs. 

const mediaHandlers = (STATE, HISTORY, player) =>
{
    if ('mediaSession' in navigator) 
    {
        navigator.mediaSession.setActionHandler(CONFIG.dummyPlay, async () => 
        { 
            if(DEBUG) console.log(`----PLAY---- (${navigator.mediaSession.playbackState})`); 
            
            switch(STATE.currentSource)
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
                    updateDummyPlayerStatus(STATE.currentSource, CONFIG.dummyPlay);
                    break;
                case LOCAL_SOURCE:
                    toggleLocalPlayback(LOCAL_SOURCE);
                    break;
            }
        });
        navigator.mediaSession.setActionHandler(CONFIG.dummyPause, async () => 
        { 
            if(DEBUG) console.log(`----PAUSE---- (${navigator.mediaSession.playbackState})`); 
           
            switch(STATE.currentSource)
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
                    updateDummyPlayerStatus(STATE.currentSource, CONFIG.dummyPause);
                    break;
                case LOCAL_SOURCE:
                    toggleLocalPlayback();
                    break;
            }
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => 
        { 
            if(DEBUG) console.log("----PREV----");
            playPrevTrack(STATE, HISTORY, player);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => 
        { 
            if(DEBUG) console.log("----NEXT-----"); 
            playNextTrack(STATE, HISTORY, player);
        });
    }
}

const clickHandler = (STATE, HISTORY, player) =>
{
    switch (event.target.id)
    {
        case 'playlistToggle':
            modifyVisibility("#trackList");
            break;
        case 'coverToggle':
            modifyVisibility("#cover", CONFIG.coverOpacity, checkSrc=true);
            break;
        case 'shuffleToggle':
            toggleShuffle(STATE);
            break;
        case 'pauseToggle':
            pauseToggle(STATE, HISTORY, player);    
            break;
        case 'volumeUp':
            setVolume(STATE.currentSource, CONFIG.volumeStep);
            break;
        case 'volumeDown':
            setVolume(STATE.currentSource, -CONFIG.volumeStep);
            break;
        case 'previous':
            playPrevTrack(STATE, HISTORY, player);
            break;
        case 'next':
            playNextTrack(STATE, HISTORY, player);
            break;
        case 'seekForward':
            seekPlayback(STATE.currentSource, 1);
            break;
        case 'seekBack':
            seekPlayback(STATE.currentSource, -1);
            break;
    }
}