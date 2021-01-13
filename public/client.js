window.onSpotifyWebPlaybackSDKReady = () => 
{
    if (document.location.href.match("/home"))
    {
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
        const player = new Spotify.Player({
            name: CONFIG.playerName,
            getOAuthToken: cb => { cb( getCookiesAsJSON().access_token  ); }
        });
       
        // Before interacting with (most) API endpoints we need to 'activate' the player (see status from /devices)
        // the listener for 'ready' will trigger `InitSpotifyPlayer()` to activate it and set shuffle + default volume
        addPlayerListeners(player);
        
        // Connect the player
        player.connect();

        // Add global event listeners
        window.addEventListener('click',   ()      => clickHandler(player)           );
        window.addEventListener('keydown', (event) => keyboardHandler(event, player) );
        
        // Initiate timer for sending a request to /refresh to get a new access_token
        refreshToken(player);

        // Initiate the mediakey handlers
        mediaHandlers(player);

        // Setup the listener for the spotify and local playlist <select> elements
        document.querySelector("#spotifyPlaylist").addEventListener('change', async () => 
        {
            // Set the global track counter
            updatePlaylistCount(SPOTIFY_SOURCE);

            if ( getCurrentPlaylist(SPOTIFY_SOURCE) != CONFIG.noContextOption )
            {
                while ( GLOBALS.historyPos != 0 )
                // Remove any 'future' items in the HISTORY to guarantee a new track
                {
                    HISTORY.shift();
                    GLOBALS.historyPos--;
                }

                playNextTrack(player);
            }

            // Update the playlist UI with tracks from the current playlist (and remove previous tracks)
            addPlaylistTracksToUI(SPOTIFY_SOURCE);
        });

        // Setup listeners for the dummy <audio> 
        document.querySelector("#dummy").onplay  = dummyAudioHandler('playing');
        document.querySelector("#dummy").onpause = dummyAudioHandler('paused');

        document.querySelector("#dummy").addEventListener('timeupdate', () =>
        // We will use timeupdates from the dummy player (which is synced up to play
        // in correspondence with spotify) to produce a progress bar which the spotify player can use
        {
            updateProgressIndicator();
        });

        //****** Local Player **********/        
        setLocalPlaylistOptions();
        setLocalVolume(null,CONFIG.defaultPercent);
        
        (async ()=>
        {
            await updatePlaylistCount(LOCAL_SOURCE);
            addPlaylistTracksToUI(LOCAL_SOURCE);
        })();

        // Event listener for changes to the playlist <select> element
        document.querySelector("#localPlaylist").addEventListener('change', () => 
        { 
            // Set the global track counter
            updatePlaylistCount(LOCAL_SOURCE);
            
            if ( getCurrentPlaylist(LOCAL_SOURCE) != CONFIG.noContextOption )
            {
                while ( GLOBALS.historyPos != 0 )
                // Remove any 'future' items in the HISTORY to guarantee a new track
                {
                    HISTORY.shift();
                    GLOBALS.historyPos--;
                }

                playNextTrack(player);
            }
            
            // Add tracks to the UI
            addPlaylistTracksToUI(LOCAL_SOURCE);
        });

        document.querySelector("#localPlayer").addEventListener('ended', () => 
        // Event listener for when a track ends
        { 
            playNextTrack(player);
        });

        document.querySelector("#localPlayer").addEventListener('timeupdate', () => 
        // Event listener to contiously update progress indicator
        { 
            updateProgressIndicator();
        });
    };
}
