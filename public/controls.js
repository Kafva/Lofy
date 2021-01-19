import { DEBUG, CONFIG } from './clientConfig.js'
import * as Functions    from './clientFunctions.js'

const keyboardHandler = (STATE, HISTORY, spotifyPlayer, event) => 
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
                Functions.pauseToggle(STATE, HISTORY, spotifyPlayer);
                break;
        }
    }
    else 
    {
        switch(event.key)
        {
            case CONFIG.debugInfo:
                Functions.getDebug(STATE,HISTORY);
                break;
            case CONFIG.volumeUp:
                Functions.setVolume(STATE.currentSource, CONFIG.volumeStep);
                break;
            case CONFIG.volumeDown:
                Functions.setVolume(STATE.currentSource,-CONFIG.volumeStep);
                break;
            case CONFIG.next:
                Functions.playNextTrack(STATE, HISTORY, spotifyPlayer);
                break;
            case CONFIG.previous:
                Functions.playPrevTrack(STATE, HISTORY, spotifyPlayer);
                break;
            case CONFIG.seekForward:
                Functions.seekPlayback(STATE.currentSource, 1);
                break;
            case CONFIG.seekBack:
                Functions.seekPlayback(STATE.currentSource, -1);
                break;
            case CONFIG.scrollBottom:
                window.scrollTo(0,document.querySelector("#trackList").scrollHeight);
                break;
        }
    }
}

//**** MEDIA KEYS *****/
// The spotify <iframe> contains the actual web spotifyPlayer and its own mediaSession object which we can't access due to SOP
// https://github.com/spotify/web-playback-sdk/issues/105
// https://stackoverflow.com/questions/25098021/securityerror-blocked-a-frame-with-origin-from-accessing-a-cross-origin-frame

// As a work-around we use a dummy <audio> object which we register `ActionHandlers` for,
// the spotify iframe will still catch <PAUSE> events but our own dummy object will be notified
// as well when this occurs. 

const mediaHandlers = (STATE, HISTORY, spotifyPlayer) =>
{
    if ('mediaSession' in navigator) 
    {
        navigator.mediaSession.setActionHandler(CONFIG.dummyPlay, () => 
        { 
            if(DEBUG) console.log(`----PLAY---- (${navigator.mediaSession.playbackState})`); 
            Functions.mediaPlay(STATE.currentSource);
        });
        navigator.mediaSession.setActionHandler(CONFIG.dummyPause, () => 
        { 
            if(DEBUG) console.log(`----PAUSE---- (${navigator.mediaSession.playbackState})`); 
            Functions.mediaPause(STATE.currentSource);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => 
        { 
            if(DEBUG) console.log("----PREV----");
            Functions.playPrevTrack(STATE, HISTORY, spotifyPlayer);
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => 
        { 
            if(DEBUG) console.log("----NEXT-----"); 
            Functions.playNextTrack(STATE, HISTORY, spotifyPlayer);
        });
    }
}

const clickHandler = (STATE, HISTORY, spotifyPlayer) =>
{
    switch (event.target.id)
    {
        case 'playlistToggle':
            Functions.modifyVisibility("#trackList");
            break;
        case 'coverToggle':
            Functions.modifyVisibility("#cover", CONFIG.coverOpacity, true);
            break;
        case 'shuffleToggle':
            Functions.toggleShuffle(STATE);
            break;
        case 'pauseToggle':
            Functions.pauseToggle(STATE, HISTORY, spotifyPlayer);    
            break;
        case 'volumeUp':
            Functions.setVolume(STATE.currentSource, CONFIG.volumeStep);
            break;
        case 'volumeDown':
            Functions.setVolume(STATE.currentSource, -CONFIG.volumeStep);
            break;
        case 'previous':
            Functions.playPrevTrack(STATE, HISTORY, spotifyPlayer);
            break;
        case 'next':
            Functions.playNextTrack(STATE, HISTORY, spotifyPlayer);
            break;
        case 'seekForward':
            Functions.seekPlayback(STATE.currentSource, 1);
            break;
        case 'seekBack':
            Functions.seekPlayback(STATE.currentSource, -1);
            break;
    }
}

export { keyboardHandler, mediaHandlers, clickHandler };