# Cloudify
Launch with `node main.js`

Soundcloud support is (at the time of writing) not possible due to a [limit on app registrations](https://soundcloud.com/you/apps/new).

# Setup
* `npm i && node main.js`
* playlists directory
* Optional fonts
* Run as a 'service' `nohup node main.js & disown`


## TLS
Run `./scripts/ssl.bash <domain name>` to generate a self-signed server certificate and key under `./secret/` to use for HTTPS.
