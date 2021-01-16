# Lofy
Launch with `node main.js`

Soundcloud support is (at the time of writing) not possible due to a [limit on app registrations](https://soundcloud.com/you/apps/new).

# Setup
Create a Spotify developer account and register a new application. Configure a callback URL (with HTTPS) to where ever you want to access the service, default: `https://lofy:3443/callback`.

Run `./scripts/ssl.bash <domain name>` to generate a self-signed server certificate and key under `./secret/` to use for HTTPS.

* `npm i && node main.js`
* playlists directory
* Optional fonts
* Run as a 'service' 

