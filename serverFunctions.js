// Functions in `module.exports` will be available inside the required() object that is imported in server.js
// Since we assign a function to module.exports in this case we need to RETURN a dictionary
// of the functions we define 

const queryString = require('querystring');

module.exports = (CONSTS) => 
{
    
    var exports = 
    {
        stateString: (length) =>
        // Produce an alphanumeric random string
        {
            let bases = [ 48, 65, 97 ];
            let cnts  = [ 9, 25, 25  ];
            let index = -1; let str = "";

            for (let i=0; i<length; i++)
            {
                // If we multiply by 3 there is a minimal chance that we get a index out of bounds
                index = Math.floor(Math.random() * 2.9999999);
                str += String.fromCharCode( Math.floor(Math.random()*cnts[index] + bases[index]) );
            }
            
            return str;
        },

        errorRedirect: (reply,msg) =>
        {
            reply.redirect( `${CONSTS.base_uri}/error?` + 
                queryString.stringify( {error: msg })
            ); 
        },
    };


    return exports;
};
