window.onSpotifyWebPlaybackSDKReady = () => 
{
    // Note that the Spotify Web API doesn't work in 'insecure' contexts (i.e. HTTP) in Chromium
        
    // If uBlock is enabled several errors akin to
    //      "Cross-Origin Request Blocked: The Same Origin Policy disallows reading 
    //      the remote resource at https://api.spotify.com/v1/melody/v1/logging/track_stream_verification"
    // will be displayed when skipping a song due to content blocking of spotify

    if (document.location.href.match("/home"))
    {
        // https://developer.spotify.com/documentation/web-playback-sdk/reference/#objects
        // Create a "Web Playback" object which can be chosen as the device to stream music to
        // (initalised through including a script on the main page)
        const player = new Spotify.Player({
            name: CONSTS.playerName,
            getOAuthToken: cb => { cb( getCookiesAsJSON().access_token  ); }
        });
        
        // Before interacting with (most) API endpoints we need to 'activate' the player (see status from /devices)
        // the listener for 'ready' will trigger `InitPlayer()` to activate it and set shuffle + default volume
        addPlayerListeners(player);
       
        // Connect the player
        player.connect();

        // Add global event listeners
        window.addEventListener('click',   ()      => clickHandler(player)           );
        window.addEventListener('keydown', (event) => keyboardHandler(event, player) );
        
        // Initiate timer for sending a request to /refresh to get a new access_token
        refreshToken(player);

        // Setup listeners for the dummy <audio> 
        document.querySelector("#dummy").onplay  = dummyAudioHandler('playing');
        document.querySelector("#dummy").onpause = dummyAudioHandler('paused');

        // Initiate the mediakey handlers
        mediaHandlers();
    }
};

