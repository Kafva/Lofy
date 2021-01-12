
const keyboardHandler = (event, player) => 
{
    console.log(`-------- ${event.key} | (shift:${event.shiftKey}) ----------`)   

    if ( event.key == CONFIG.pausePlay )
    {
        pauseToggle(player);
    }
    else if (event.shiftKey)
    // All keybinds except SPACE require SHIFT to be held
    {
        switch(event.key)
        {
            case CONFIG.volumeUp:
                setSpotifyVolume(CONFIG.volumeStep);
                break;
            case CONFIG.volumeDown:
                setSpotifyVolume(-CONFIG.volumeStep);
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
        }
    }
}

const mediaHandlers = (player) =>
{
    if ('mediaSession' in navigator) 
    {
        navigator.mediaSession.setActionHandler('play', async () => 
        { 
            console.log(`----PLAY---- (${navigator.mediaSession.playbackState})`); 
            
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
                    break;
                case LOCAL_SOURCE:
                    toggleLocalPlayback();
                    break;
            }
            
            updateDummyPlayerStatus('play');
        });
        navigator.mediaSession.setActionHandler('pause', async () => 
        { 
            console.log(`----PAUSE---- (${navigator.mediaSession.playbackState})`); 
           
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
                    break;
                case LOCAL_SOURCE:
                    toggleLocalPlayback();
                    break;
            }
            updateDummyPlayerStatus('pause');
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => 
        { 
            console.log("----PREV----");
            playPrevTrack(player);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => 
        { 
            console.log("----NEXT-----"); 
            playNextTrack(player);
        });
    }
}

const clickHandler = (player) =>
{
    switch (event.target.id)
    {
        case 'pauseToggle':
            pauseToggle(player);    
            break;
        case 'volumeUp':
            setSpotifyVolume(CONFIG.volumeStep);
            break;
        case 'volumeDown':
            setSpotifyVolume(-CONFIG.volumeStep);
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

