
const getParamDict = () =>
{
    var param_dict = {};
    
    let param_str = window.location.href.replace(/.*\/home\?/, '');
    let keys = param_str.split('&').map( (e) => [e.split('=')[0]]  ) 
    let vals = param_str.split('&').map( (e) => [e.split('=')[1]]  ) 
    for (let i=0; i<keys.length; i++){ param_dict[keys[i]] = vals[i]; }
    
    return param_dict;
}

const refreshToken = async (expires_in,refresh_token) =>
{
    // Wait the time specified by expires_in and after that send a request to the
    // servers /refresh endpoint to update the access_token
    //await new Promise(r => setTimeout(r, expires_in*1000));
    await new Promise(r => setTimeout(r, 2000));
    
    var req = new XMLHttpRequest();
    req.open('GET', '/refresh?' + `refresh_token=${refresh_token}`, true);

    req.onload = () => 
    {
        // Request finished, do something(?)
        console.log("Recived response from /refresh: ", req.response);
    };
    
    req.send('');
}

//********** API Endpoints ******************/

const listDevices = async ( access_token ) => 
{
    console.log(`Token: ${access_token}`);
    let res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
    
    // The response contains a readable stream in the body
    res_data = await res.body.getReader().read();

    let res_ = document.querySelector('#deviceList'); 
    res_.innerText = ""
    res_.innerText =  new TextDecoder("utf-8").decode(res_data.value);
};

const playTrack = ( spotify_uri, playerId, access_token ) => 
{
    console.log(`Token: ${access_token}`);
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [spotify_uri] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
};


const addPlayerListeners = (player) =>
{
    // See https://developer.spotify.com/documentation/web-playback-sdk/quick-start/
    // Error handling
    const errors = ['initialization_error', 'authentication_error', 'account_error', 'playback_error'];
    errors.forEach( (item) => 
    {
        player.addListener(item, ({message}) => console.error(`${item}:`, message)  );
    });

    // Playback status updates
    player.addListener('player_state_changed', state => { console.log('player_state_changed', state); });

    // Ready
    player.addListener('ready', ({ device_id }) => { console.log('Ready with Device ID', device_id); });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => { console.log('Device ID has gone offline', device_id); });
}

//********* MISC *********//

const insertInfoList = (selector,param_dict) =>
{
    let ul = document.querySelector(selector);
    
    let li = document.createElement("li"); li.innerText = `cookie: ${document.cookie}` 
    ul.appendChild( li );
    
    for (let key in param_dict)
    {
        li = document.createElement("li"); li.innerText = `${key}:${param_dict[key]}` 
        ul.appendChild( li );
    }
}