const CONSTS = {
    audioSources: [ 'spotify', 'local' ],
    volumeStep: 5,
    defaultPercent: 20,
    playerName: 'Cloudify Player',
    inactivePlayer: 'Player inactive',
    pauseText: '< Pause >',
    playText: '< Play >',
    newTrackDelay: 1500,

    //** Shortcuts **/
    pausePlay: ' ',
    previous: 'ArrowLeft',
    volumeDown: 'ArrowDown',
    next: 'ArrowRight',
    volumeUp: 'ArrowUp',
}

var GLOBALS = {
    currentSource: null,
    local_playlist_count: null,
    spotify_playlist_count: null,
}
