const SPOTIFY_SOURCE = 'spotify';
const LOCAL_SOURCE   = 'local';

const CONFIG = {
    historyLimit: 50,
    volumeStep: 5,
    seekStepMs: 5000, // (ms)
    defaultPercent: 20,
    playerName: 'Cloudify Player',
    inactivePlayer: 'Player inactive',
    pauseClass: 'clickable nf nf-fa-pause',
    playClass: 'clickable nf nf-fa-play',
    spotifyIconCSS: 'nf nf-fa-spotify',
    localIconCSS: 'nf nf-mdi-file_music',
    noContextOption: '-',
    newTrackDelay: 1500,
    defaultAutoRepeatState: 'off',
    
    // The dummy track queued after every song to allow for an OK transisation between
    // local/spotify tracks (we cannot reliably pause the spotify player upon the end of a track)
    spotifySilence: "spotify:track:7cctPQS83y620UQtMd1ilL",

    //** Default config **/
    defaultLocalPlaylist: 'dv',
    defaultSpotifyPlaylist: '🌙',

    //** Shortcuts **/
    // Each one except <SPACE> requires <SHIFT> as a modifier
    pausePlay: ' ',
    previous: 'ArrowLeft',
    volumeDown: 'ArrowDown',
    next: 'ArrowRight',
    volumeUp: 'ArrowUp',
    seekBack: 'H',
    seekForward: 'L',
}

var GLOBALS = {
    currentSource: null,

    // To show the progress indicator for spotify the 'timeupdate' events from
    // the silent dummy track that plays alongside spotify is used
    currentDuration: 
    {
        min: -1,
        sec: -1
    },
    dummyProgressOffset: 
    {
        min: -1,
        sec: -1
    },

    mutexTaken: false,

    // Contains the number of tracks for the current playlist from each source
    playlistCount: {
        spotify: null,
        local: null
    },

    // The current history position
    // incremented/decremented when playing next/previous track
    historyPos: 0,
}

// The trackNum corresponds to the index in a local or spotify playlist
// { playlist: <...>, trackNum: <...> , spotifyURI: <...> }
var HISTORY = [];