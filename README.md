# Lofy

## Setting up the service
Create a Spotify developer account and register a new application. Configure a callback URL (with HTTPS) to where ever you want to access the service, default being, `https://lofy:3443/callback`.

Run `./scripts/ssl.bash <domain name>` to generate a self-signed server certificate and key under `./secret/` to use for HTTPS. To install the certificate of the CA on macOS one can use the command 

```bash
	sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl/certs/ca.crt.
```

Install node dependencies

```bash
	npm install
```

A configuration to manage the service via `launchctl` is included. Note that to use the provided `com..lofy.plist` configuration the `WorkingDirectory` needs to be modified in accordance with the setup.

```bash
	# Load the service (not persistent after a reboot) 
		launchctl load conf/com..lofy.plist

	# Start/Stop the service
		launchctl start com..lofy
		launchctl stop  com..lofy

```

On first visit the site will redirect for OAuth authentication with Spotify. Note that a bookmark of the service should not contain the `/home?redirect=true` query string.

## Local playlists
Local playlists are read from the `playlist` directory in the project folder and should contain the complete path to each audio file in the playlist (newline separated).
