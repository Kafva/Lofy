
window.onSpotifyWebPlaybackSDKReady = () => 
{
    if (document.location.href.match("/home"))
    {
        // Extract the URL parameters into a JSON object
        var param_dict = getParamDict();
   
        insertInfoList('#params',param_dict);

        // refreshToken(param_dict.expires_in, param_dict.refresh_token);

        var spotify_uri = 'spotify:track:6EtKlIQmGPB9SX8UjDJG5s'
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

        // Before sending a URI to the 'play' endpoint we need to 'activate' the player, we can see
        // the player state from the devices endpoint
        
        // TODO set an event listener for the entire window and redirect cases from there
        document.getElementById('play').addEventListener('click', () => 
        {  
            console.log(`Playing: ${spotify_uri}`);
            // Utilise an API endpoint to modify what song is playing using the created player 
            playTrack(spotify_uri, player._options.id, access_token);
        });

        document.getElementById('devices').addEventListener('click', () => 
        {  
            // Utilise an API endpoint to modify what song is playing using the created player 
            listDevices(access_token);
        });

    }
};