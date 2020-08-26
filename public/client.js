
window.onSpotifyWebPlaybackSDKReady = () => 
{
    if (document.location.href.match("/home"))
    {
        // Extract the URL parameters into a JSON object
        var param_dict = getParamDict();
   
        insertInfoList(param_dict);

        refreshToken(param_dict.expires_in, param_dict.refresh_token);

        var spotify_uri = 'spotify:track:0HadrlP2mwJidGF3pyBX4H?si'
        var access_token = param_dict.access_token;
    }
};



//**** BASIC EXAMPLE ****/
////window.onSpotifyWebPlaybackSDKReady = () => {
//  const token = 'BQD1uZeceL6IMlO2N3XN244H3G5dByrgn7jXUItv_nTa9MnmorTfVUVFpJjlRV60FGXEFqtBO4R2B_fMkkRNR9ZIeeexwTCI9r52uEBwlEqdhM-FHabEqO25155VHFPOL_RQYkB9-vUdAEtU1v-CMGXaCDUexLp2qrA';
//  const player = new Spotify.Player({
//    name: 'Web Playback SDK Quick Start Player',
//    getOAuthToken: cb => { cb(token); }
//  });
//
//  // Error handling
//  player.addListener('initialization_error', ({ message }) => { console.error(message); });
//  player.addListener('authentication_error', ({ message }) => { console.error(message); });
//  player.addListener('account_error', ({ message }) => { console.error(message); });
//  player.addListener('playback_error', ({ message }) => { console.error(message); });
//
//  // Playback status updates
//  player.addListener('player_state_changed', state => { console.log(state); });
//
//  // Ready
//  player.addListener('ready', ({ device_id }) => {
//    console.log('Ready with Device ID', device_id);
//  });
//
//  // Not Ready
//  player.addListener('not_ready', ({ device_id }) => {
//    console.log('Device ID has gone offline', device_id);
//  });
//
//  // Connect to the player!
//  player.connect();
//};
//