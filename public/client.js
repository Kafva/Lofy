window.onSpotifyWebPlaybackSDKReady = () => 
{
    if (document.location.href.match("/home"))
    {
        // Extract the URL parameters into a JSON object
        let param_dict = getParamDict();
   
        insertInfoList('#params',param_dict);

        let access_token = param_dict.access_token;
       
        // https://developer.spotify.com/documentation/web-playback-sdk/reference/#objects
        // Create a "Web Playback" object which can be chosen as the device to stream music to
        // (initalised through including a script on the main page)
        const player = new Spotify.Player({
            name: CONSTS.playerName,
            getOAuthToken: cb => { cb(access_token); }
        });
        
        addPlayerListeners(player);
       
        // Connect the player
        player.connect();

        // Before interacting with endpoints we need to 'activate' the player, we can see
        // the player state from the devices endpoint
        
        // Initiate timer for sending a request to /refresh to get a new access_token
        // AND create the event-listener for clicks on the window (we do it inside the
        // refresh function to be able to re-register the function when a new access_token is given)
        refreshToken(player, access_token, param_dict.refresh_token, param_dict.expires_in);
    }
};