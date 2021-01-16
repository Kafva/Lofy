# Lofy

# Setup
Create a Spotify developer account and register a new application. Configure a callback URL (with HTTPS) to where ever you want to access the service, default being, `https://lofy:3443/callback`.

Run `./scripts/ssl.bash <domain name>` to generate a self-signed server certificate and key under `./secret/` to use for HTTPS. To install the certificate of the CA on macOS one can use the command `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl/certs/ca.crt`.

* `npm i && node main.js`
* playlists directory
* Optional fonts
* Run as a 'service' 
