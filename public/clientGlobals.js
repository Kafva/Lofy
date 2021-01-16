const SPOTIFY_SOURCE = 'spotify';
const LOCAL_SOURCE   = 'local';

const CONFIG = {
    historyLimit: 50,
    volumeStep: 5,
    seekStepMs: 5000, // (ms)
    defaultPercent: 20,
    playerName: 'Lofy',
    inactivePlayer: 'Player inactive',
    pauseClass: 'clickable nf nf-fa-pause',
    playClass: 'clickable nf nf-fa-play',
    rowClass: 'clickable trackItem',
    noContextOption: '-',
    newTrackDelay: 1500,
    defaultAutoRepeatState: 'off',
    tableColumns: 5,
    unknown: 'Unknown',
    dummyPlay: 'play',
    dummyPause: 'pause',
   
    scrollPixels: 400,

    currentTrackCSS: "amp",

    iconCSS: {
        [SPOTIFY_SOURCE]: 'nf nf-fa-spotify', 
        [LOCAL_SOURCE]: 'nf nf-mdi-file_music'
    },
    
    // The dummy track queued after every song to allow for an OK transisation between
    // local/spotify tracks (we cannot reliably pause the spotify player upon the end of a track)
    spotifySilence: "spotify:track:7cctPQS83y620UQtMd1ilL",

    //** Default config **/
    defaultLocalPlaylist: 'purpose',
    defaultSpotifyPlaylist: '✨',

    //** Shortcuts **/
    pausePlay: ' ',
    scrollUp: 'k',
    scrollDown: 'j',
    scrollTop: 'g',
    scrollBottom: 'G',

    // With <SHIFT> modifier 
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
    dummyProgressOffsetSec: -1, 

    mutexTaken: false,

    // Contains the number of tracks for the current playlist from each source
    currentPlaylistCount: {
        [SPOTIFY_SOURCE]: null,
        [LOCAL_SOURCE]: null
    },

    // The current history position
    // incremented/decremented when playing next/previous track
    historyPos: 0,
}

// The trackNum corresponds to the index in a local or spotify playlist
// { playlist: <...>, trackNum: <...> , spotifyURI: <...> }
var HISTORY = [];