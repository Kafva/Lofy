
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
        // Request finished. Do processing here.
        console.log("TODO", req.response);
    };
    
    req.send('');
}


//********* MISC *********//

const insertInfoList = (param_dict) =>
{
    let ul = document.querySelector("#list");
    
    let li = document.createElement("li"); li.innerText = `cookie: ${document.cookie}` 
    ul.appendChild( li );
    
    for (let key in param_dict)
    {
        li = document.createElement("li"); li.innerText = `${key}:${param_dict[key]}` 
        ul.appendChild( li );
    }
}