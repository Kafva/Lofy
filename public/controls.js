import { DEBUG, CONFIG }     from './clientConfig.js';
import { getPlayerJSON } from './spotifyFunctions.js';
import * as Functions        from './stateFunctions.js';
import * as Util             from './util.js';


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
                if(DEBUG)
                {
                    (async () => 
                    {
                        let _json = await getPlayerJSON();
                        console.log("DEBUG:",STATE,HISTORY, _json);
                    })();
                }    
                break;
            case CONFIG.volumeUp:
                Util.setVolume(STATE.currentSource, CONFIG.volumeStep);
                break;
            case CONFIG.volumeDown:
                Util.setVolume(STATE.currentSource,-CONFIG.volumeStep);
                break;
            case CONFIG.next:
                Functions.playNextTrack(STATE, HISTORY, spotifyPlayer);
                break;
            case CONFIG.previous:
                Functions.playPrevTrack(STATE, HISTORY, spotifyPlayer);
                break;
            case CONFIG.seekForward:
                Util.seekPlayback(STATE.currentSource, 1);
                break;
            case CONFIG.seekBack:
                Util.seekPlayback(STATE.currentSource, -1);
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
        navigator.mediaSession.setActionHandler(CONFIG.play, () => 
        { 
            if(DEBUG) console.log(`----PLAY---- (${navigator.mediaSession.playbackState})`); 
            Util.mediaPlay(STATE.currentSource);
        });
        navigator.mediaSession.setActionHandler(CONFIG.pause, () => 
        { 
            if(DEBUG) console.log(`----PAUSE---- (${navigator.mediaSession.playbackState})`); 
            Util.mediaPause(STATE.currentSource);
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
            Util.modifyVisibility("#trackList");
            break;
        case 'coverToggle':
            Util.modifyVisibility("#cover", CONFIG.coverOpacity, true, true);
            break;
        case 'shuffleToggle':
            Util.toggleShuffle(STATE);
            break;
        case 'pauseToggle':
            Functions.pauseToggle(STATE, HISTORY, spotifyPlayer);    
            break;
        case 'volumeUp':
            Util.setVolume(STATE.currentSource, CONFIG.volumeStep);
            break;
        case 'volumeDown':
            Util.setVolume(STATE.currentSource, -CONFIG.volumeStep);
            break;
        case 'previous':
            Functions.playPrevTrack(STATE, HISTORY, spotifyPlayer);
            break;
        case 'next':
            Functions.playNextTrack(STATE, HISTORY, spotifyPlayer);
            break;
        case 'seekForward':
            Util.seekPlayback(STATE.currentSource, 1);
            break;
        case 'seekBack':
            Util.seekPlayback(STATE.currentSource, -1);
            break;
    }
}

export { keyboardHandler, mediaHandlers, clickHandler };