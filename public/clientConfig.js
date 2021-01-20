const DEBUG = true;
const SPOTIFY_SOURCE = 'spotify';
const LOCAL_SOURCE   = 'local';

const CONFIG = Object.freeze({
    //** Default config **/
    defaultLocalPlaylist: 'Df',
    defaultSpotifyPlaylist: '✨',
    
    historyLimit: 50,
    volumeStep: 5,
    seekStepMs: 5000, // (ms)
    defaultPercent: 20,
    spotifyPlayerName: 'Lofy',
    inactivePlayer: 'Player inactive',
    pauseClass: 'clickable nf nf-fa-pause',
    playClass: 'clickable nf nf-fa-play',
    rowClass: 'clickable trackItem',
    noShuffleClass: 'nf nf-mdi-shuffle_disabled',
    shuffleClass: 'nf nf-mdi-shuffle_variant',
    noContextOption: '-',
    newTrackDelay: 1500,
    defaultAutoRepeatState: 'off',
    tableColumns: 5,
    unknown: 'Unknown',
    play: 'play',
    pause: 'pause',
    
    coverOpacity: 0.6,
    coverHeight: 300,
    coverWidth: 300,
    tintColor: 'var(--tint)',
    textColor: 'var(--text)',

    scrollPixels: 400,

    currentTrackCSS: "amp",

    iconCSS: {
        [SPOTIFY_SOURCE]: 'nf nf-fa-spotify', 
        [LOCAL_SOURCE]: 'nf nf-mdi-file_music'
    },
    
    // The dummy track queued after every song to allow for an OK transisation between
    // local/spotify tracks (we cannot reliably pause the spotify spotifyPlayer upon the end of a track)
    spotifySilence: "spotify:track:7cctPQS83y620UQtMd1ilL",

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
    debugInfo: 'D',
});

export { DEBUG, SPOTIFY_SOURCE, LOCAL_SOURCE, CONFIG };