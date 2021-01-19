import { SPOTIFY_SOURCE, LOCAL_SOURCE, CONFIG } from './clientConfig.js';
import * as SpotifyFunctions from './spotifyFunctions.js';
import * as LocalFunctions   from './localPlayerFunctions.js';
import * as Functions        from './clientFunctions.js';
import * as Controls         from './controls.js';

window.onSpotifyWebPlaybackSDKReady = () => 
{
    if (document.location.href.match("/home"))
    {
        // The trackNum corresponds to the index in a local or spotify playlist
        // { playlist: <...>, trackNum: <...> , spotifyURI: <...> }
        // We need to make the HISTORY a {object} to be able to pass it by reference
        const HISTORY = { arr: [] };
        const STATE = {
            currentSource: null,
            shuffle: true,
            
            // To show the progress indicator for spotify the 'timeupdate' events from
            // the silent dummy track that plays alongside spotify is used
            currentDuration: 
            {
                min: -1,
                sec: -1
            },
            dummyProgressOffsetSec: -1, 
            
            mutexTaken: false,
        
            // Contains the number of tracks for the current playlist from each source
            currentPlaylistCount: {
                [SPOTIFY_SOURCE]: null,
                [LOCAL_SOURCE]: null
            },
        
            // The current history position
            // incremented/decremented when playing next/previous track
            historyPos: 0,
        };
        
        // Note that the Spotify Web API doesn't work in 'insecure' contexts (i.e. HTTP) in Chromium
            
        // If uBlock is enabled several errors akin to
        //      "Cross-Origin Request Blocked: The Same Origin Policy disallows reading 
        //      the remote resource at https://api.spotify.com/v1/melody/v1/logging/track_stream_verification"
        // will be displayed when skipping a song due to content blocking of spotify
        // Web console View filter:
        // -url:https://api.spotify.com/v1/melody/v1/logging/track_stream_verification -url:https://api.spotify.com/v1/melody/v1/logging/jssdk_playback_stats -url:https://api.spotify.com/v1/melody/v1/logging/jssdk_error

        // https://developer.spotify.com/documentation/web-playback-sdk/reference/#objects
        // Create a "Web Playback" object which can be chosen as the device to stream music to
        // (initalised through including a script on the main page)
        const spotifyPlayer = new Spotify.Player({
            name: CONFIG.spotifyPlayerName,
            getOAuthToken: cb => { cb( SpotifyFunctions.getCookiesAsJSON().access_token  ); }
        });
       
        // Before interacting with (most) API endpoints we need to 'activate' the spotifyPlayer (see status from /devices)
        // the listener for 'ready' will trigger `InitSpotifyPlayer()` to activate it and set shuffle + default volume
        Functions.addPlayerListeners(STATE, HISTORY, spotifyPlayer);
        
        // Connect the spotifyPlayer
        spotifyPlayer.connect();

        // Add global event listeners
        window.addEventListener('click',   ()      => Controls.clickHandler   (STATE, HISTORY, spotifyPlayer)           );
        window.addEventListener('keydown', (event) => Controls.keyboardHandler(STATE, HISTORY, spotifyPlayer, event) );
        
        // Initiate timer for sending a request to /refresh to get a new access_token
        SpotifyFunctions.refreshToken(spotifyPlayer);

        // Initiate the mediakey handlers
        Controls.mediaHandlers(STATE, HISTORY, spotifyPlayer);

        // Setup the listener for the spotify and local playlist <select> elements
        document.querySelector("#spotifyPlaylist").addEventListener('change', async () => 
        {
            // Set the global track counter
            Functions.updatePlaylistCount(STATE, SPOTIFY_SOURCE);

            let currentPlaylist = null;
            try { currentPlaylist = Functions.getCurrentPlaylist(SPOTIFY_SOURCE); }
            catch (e) { console.error(e); return; }

            if ( currentPlaylist != CONFIG.noContextOption )
            {
                while ( STATE.historyPos != 0 )
                // Remove any 'future' items in the HISTORY to guarantee a new track
                {
                    HISTORY.arr.shift();
                    STATE.historyPos--;
                }

                Functions.playNextTrack(STATE, HISTORY, spotifyPlayer, SPOTIFY_SOURCE);
            }

            // Update the playlist UI with tracks from the current playlist (and remove previous tracks)
            Functions.addPlaylistTracksToUI(STATE, HISTORY, SPOTIFY_SOURCE, spotifyPlayer);
        });

        // Setup listeners for the dummy <audio> 
        document.querySelector("#dummy").onplay  = Functions.dummyAudioHandler('playing');
        document.querySelector("#dummy").onpause = Functions.dummyAudioHandler('paused');

        document.querySelector("#dummy").addEventListener('timeupdate', () =>
        // We will use timeupdates from the dummy spotifyPlayer (which is synced up to play
        // in correspondence with spotify) to produce a progress bar which the spotify spotifyPlayer can use
        {
            Functions.updateProgressIndicator(STATE);
        });

        //****** Local Player **********/        
        LocalFunctions.setLocalVolume(null,CONFIG.defaultPercent);
        
        (async ()=>
        {
            await LocalFunctions.setLocalPlaylistOptions();
            await Functions.updatePlaylistCount(STATE, LOCAL_SOURCE);
            Functions.addPlaylistTracksToUI(STATE, HISTORY, LOCAL_SOURCE, spotifyPlayer);
        })();

        // Event listener for changes to the playlist <select> element
        document.querySelector("#localPlaylist").addEventListener('change', async () => 
        { 
            // Set the global track counter
            await Functions.updatePlaylistCount(STATE, LOCAL_SOURCE);
            
            let currentPlaylist = null;
            try { currentPlaylist = Functions.getCurrentPlaylist(LOCAL_SOURCE); }
            catch (e) { console.error(e); return; }
            
            if ( currentPlaylist != CONFIG.noContextOption )
            {
                while ( STATE.historyPos != 0 )
                // Remove any 'future' items in the HISTORY to guarantee a new track
                {
                    HISTORY.arr.shift();
                    STATE.historyPos--;
                }

               Functions.playNextTrack(STATE, HISTORY, spotifyPlayer, LOCAL_SOURCE);
            }
            
            // Add tracks to the UI
            Functions.addPlaylistTracksToUI(STATE, HISTORY, LOCAL_SOURCE, spotifyPlayer);
        });

        document.querySelector("#localPlayer").addEventListener('ended', () => 
        // Event listener for when a track ends
        {
            Functions.playNextTrack(STATE, HISTORY, spotifyPlayer);
        });

        document.querySelector("#localPlayer").addEventListener('timeupdate', () => 
        // Event listener to contiously update progress indicator
        { 
            Functions.updateProgressIndicator(STATE);
        });
    };
}
