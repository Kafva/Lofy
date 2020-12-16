
window.onSpotifyWebPlaybackSDKReady = () => 
{
    if (document.location.href.match("/home"))
    {
        // Extract the URL parameters into a JSON object
        var param_dict = getParamDict();
   
        insertInfoList('#params',param_dict);

        // refreshToken(param_dict.expires_in, param_dict.refresh_token);
        
        var access_token = param_dict.access_token;
       
        // https://developer.spotify.com/documentation/web-playback-sdk/reference/#objects
        // Create a "Web Playback" object which can be chosen as the device to stream music to
        // (initalised through including a script on the main page)
        const player = new Spotify.Player({
            name: 'Cloudify Player',
            getOAuthToken: cb => { cb(access_token); }
        });
        
        addPlayerListeners(player);
       
        // Connect the player
        player.connect();

        // Before interacting with endpoints we need to 'activate' the player, we can see
        // the player state from the devices endpoint
        
        // Instead of setting specific events for specific elements we will use a global catch all
        // listener and redirect events based on what was clicked 
        window.addEventListener('click', () => clickHandler(player,access_token) );

    }
};