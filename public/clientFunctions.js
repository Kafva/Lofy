const FAIL = -1;
const volumeStep = 10;
const playerName = 'Cloudify Player';

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

//********** EVENT HANDLING ******************/
const clickHandler = (player,access_token) =>
{
    var spotify_uri = 'spotify:track:0IedgQjjJ8Ad4B3UDQ5Lyn'

    switch (event.target.id)
    {
        case 'play':
            playTrack(spotify_uri, player._options.id, access_token); 
            break;
        case 'devices':
            listDevices(access_token); 
            break;
        //-- Requires player to be active --//
        case 'pauseToggle':
            togglePlayback(access_token); 
            break;
        case 'playerInfo':
            getPlayerInfo(access_token);
            break;
        case 'volumeUp':
            setVolume(volumeStep,playerId,access_token);
            break;
        case 'volumeDown':
            setVolume(-volumeStep,playerId,access_token);
            break;
    }
}

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

//********** API Endpoints ******************/

const playTrack = ( spotify_uri, playerId, access_token ) => 
{
    console.log(`Playing: ${spotify_uri}`);
    fetch(`https://api.spotify.com/v1/me/player/play?device_id=${playerId}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [spotify_uri] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });

    document.querySelector("#pauseToggle").innerText = "< Pause >";
}

const listDevices = async ( access_token ) => 
{
    let res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
    
    // The response contains a readable stream in the body
    res_data = await res.body.getReader().read();

    //document.querySelector('#deviceList').innerText = "";
    document.querySelector('#deviceList').innerText =  new TextDecoder("utf-8").decode(res_data.value);
}

const getPlayerInfo = async ( access_token ) =>
{
    let res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
    
    // The response contains a readable stream in the body
    res_data = await res.body.getReader().read();

    document.querySelector('#playerInfoList').innerText =  new TextDecoder("utf-8").decode(res_data.value);
}

const togglePlayback = async ( access_token ) => 
{
    //*** NOTE that one cannot directly ['index'] the return value from an async function */
    let a = await getDeviceJSON(access_token)
    console.log("is_active", a, a['is_active'])
    if (a['is_active'])
    {
        a = await getPlayerJSON(access_token)
        console.log("is_playing", a, a['is_playing'])
        if (a['is_playing'])
        {
            await fetch(`https://api.spotify.com/v1/me/player/pause`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${access_token}` },
            });
            document.querySelector("#pauseToggle").innerText = "< Play >";
        }
        else
        {
            await fetch(`https://api.spotify.com/v1/me/player/play`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${access_token}` },
            });
            document.querySelector("#pauseToggle").innerText = "< Pause >";
        }
    }
    else { console.log("Player inactive"); }
}


const setVolume = (diff, access_token ) =>
// Change the volume by diff percent
{
    // Fetch the current volume
    console.log(`Setting volume: ${diff} % (Token: ${access_token})`);
    fetch(`https://api.spotify.com/v1/me/player/volume?volume_percent=${diff}`, {
        method: 'PUT',
        body: JSON.stringify({ uris: [spotify_uri] }),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
}

//********* MISC *********//

const getDeviceJSON = async (access_token) =>
// async functions always return a Promise for their return value
{
    let res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
    
    // The response contains a readable stream in the body
    res_data = await res.body.getReader().read();
    res_data = new TextDecoder("utf-8").decode(res_data.value);
    
    let _dev = null;
    let devices = null;
    
    try { devices = JSON.parse(res_data)['devices'];  }
    catch (e) { console.error(e); }
    
    // Return the device corresponding to the player
    devices.forEach( (device) => {
        console.log("loop:",device)
        if (device['name'] == playerName)
        { 
            _dev = device; 
        }
    });

    return _dev;
}



const getPlayerJSON = async (access_token) =>
{
    let res = await fetch('https://api.spotify.com/v1/me/player', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
    });
    
    // The response contains a readable stream in the body
    res_data = await res.body.getReader().read();
    res_data = new TextDecoder("utf-8").decode(res_data.value);
    
    try
    {
        return JSON.parse(res_data);
    }
    catch (e) { console.error(e); }
}


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

const getParamDict = () =>
{
    var param_dict = {};
    
    let param_str = window.location.href.replace(/.*\/home\?/, '');
    let keys = param_str.split('&').map( (e) => [e.split('=')[0]]  ) 
    let vals = param_str.split('&').map( (e) => [e.split('=')[1]]  ) 
    for (let i=0; i<keys.length; i++){ param_dict[keys[i]] = vals[i]; }
    
    return param_dict;
}
