const SPOTIFY_SOURCE = 'spotify';
const LOCAL_SOURCE   = 'local';

const CONSTS = {
    
    // Contains a key per audio source and a reference to functions that need to be implemented
    audioSources: {
        spotify:
        {
            getCurrentPlaylist: () => document.querySelector("#spotifyPlaylist").selectedOptions[0].innerText
        },
        local:
        {
            getCurrentPlaylist: () => document.querySelector("#localPlaylist").selectedOptions[0].innerText
        }
    },

    volumeStep: 5,
    seekStep: 5000, // (ms)
    defaultPercent: 20,
    playerName: 'Cloudify Player',
    inactivePlayer: 'Player inactive',
    pauseText: '< Pause >',
    playText: '< Play >',
    noContextOption: '-',
    newTrackDelay: 1500,
    defaultAutoRepeatState: 'off',
    
    // The dummy track queued after every song to allow for an OK transisation between
    // local/spotify tracks (we cannot reliably pause the spotify player upon the end of a track)
    spotifySilence: "spotify:track:7cctPQS83y620UQtMd1ilL",

    //** Default config **/
    defaultLocalPlaylist: 'lain',
    defaultSpotifyPlaylist: '✨',

    //** Shortcuts **/
    // Each one except <SPACE> requires <SHIFT> as a modifier
    pausePlay: ' ',
    previous: 'ArrowLeft',
    volumeDown: 'ArrowDown',
    next: 'ArrowRight',
    volumeUp: 'ArrowUp',
    seekBack: 'H',
    seekForward: 'L'
}

var GLOBALS = {
    currentSource: null,
    mutexTaken: false,

    // Contains the index of the previous track to avoid the
    // shuffle algorithm to choose the same track twice in a row
    // (Doubles as the current number since it is updated once a new track begins to play)
    prevNum: {
        spotify: -1,
        local: -1,
    },
    
    // Contains the number of tracks for the current playlist from each source
    playlistCount: {
        spotify: null,
        local: null
    }
}