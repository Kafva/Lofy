# Lofy

![](.github/screenshot.png)

## Setting up the service
Create a Spotify developer account and register a new application, note the *client id* and *client secret* for the application and create corresponding files with these values in the project directory, `./secret/client_id`, `./secret/client_secret`. Configure a callback URL (with HTTPS) to where ever you want to access the service, default being, `https://lofy:3443/callback`.

To setup TLS create a `server.key` and `server.crt` with `openssl` signed by a trusted CA and place them under `./secret`.

Install node dependencies

```bash
npm install
```

The app can then be ran with `node main.js`. A configuration to manage the service via `launchctl` is included. Note that to use the provided `com..lofy.plist` configuration the `WorkingDirectory` needs to be modified in accordance with the setup. If you are using `nvm` you may also haft to change the path to the `node` executable.

```bash
# Load the service (not persistent after a reboot) 
launchctl load conf/com..lofy.plist

# Start/Stop the service
launchctl start com..lofy
launchctl stop  com..lofy

```

To have the service launch automatically on startup, change the value for the `RunAtLoad` key to `true` and copy the `com..lofy.plist` file to `~/Library/LaunchAgents/`.

On first visit the site will redirect for OAuth authentication with Spotify.

## Local playlists
Local playlists are read from the `playlists` directory in the project folder and should contain the complete path to each audio file in the playlist (newline separated). An interface to play only local files without Spotify authentication is available at `/local`.

## (Some) issues
* Spamming inputs (pause/play...) in quick succession can easily bring the Spotify player into an undefined state
* Breaks with silence (of varying length) will occur in between tracks when using Spotify
* Performance becomes lackluster when using 20+ local playlists (not an intended use case)
