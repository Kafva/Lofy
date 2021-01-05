window.onSpotifyWebPlaybackSDKReady = () => 
{
    document.querySelector('iframe[src="https://sdk.scdn.co/embedded/index.html"]').style = "";
        
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
        
        addPlayerListeners(player);
       
        // Connect the player
        player.connect();

        // Before interacting with endpoints we need to 'activate' the player, we can see
        // the player state from the devices endpoint
        
        // Add global event listeners
        window.addEventListener('click',   ()      => clickHandler(player)           );
        window.addEventListener('keydown', (event) => keyboardHandler(event, player) );
        
        // Initiate timer for sending a request to /refresh to get a new access_token
        refreshToken(player);

        //mediaHandlers();
    }
};