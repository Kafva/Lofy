#!/bin/bash
exitErr(){ echo -e "$1" >&2 ; exit 1; }
usage="usage: $(basename $0) <server domain name>"

[ -z "$1" ] && exitErr "$usage"
name=$1

# Run as ./scripts/ssl.bash
lifetime=730
sslPath=$PWD/ssl
outdir=$PWD/secret
sslConf=$PWD/scripts/openssl.cnf

mkdir -p $sslPath $outdir
mkdir -p $sslPath/certs $sslPath/newcerts $sslPath/private $sslPath/crl
[ -f $sslPath/serial ] || echo 01 > $sslPath/serial
[ -f $sslPath/index.txt ] || touch $sslPath/index.txt

#-------------------------------------#
# https://support.apple.com/en-us/HT210176
# Apple requirements 
# 	* Hash algorithm must be sha256 or better for TLS
# 	* DNS names in the CommonName of a certificate are no longer trusted (use Subject Alternative Name)
#	* validity period of 825 days or fewer

[ -f $sslPath/private/ca.key ] || {

	# Generate self signed root CA cert
	openssl req -config <(cat $sslConf | sed "s/lofy/$name/g") \
		-nodes -x509 -new -days $lifetime \
		-subj "/CN=$name CA/" \
		-keyout $sslPath/private/ca.key -out $sslPath/certs/ca.crt
	false

} && printf "./$(basename $sslPath)/private/ca.key already exists\n"

[ -f $outdir/server.key ] || {
	
	# Generate server cert to be signed
	openssl req -config <(cat $sslConf | sed "s/lofy/$name/g") \
		-nodes -new -days $lifetime \
		-subj "/CN=$name/" \
		-keyout $outdir/server.key -out /tmp/server.csr &&

	# Sign the server cert
	openssl ca -config <(cat $sslConf | sed "s/lofy/$name/g") -policy policy_anything \
	-in /tmp/server.csr -out $outdir/server.crt &&

	rm -f /tmp/server.csr
	rm -f $sslPath/*.old
	false

} && printf "./$(basename $outdir)/server.key already exists\n"

printf "\033[3msudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl/certs/ca.crt\033[0m\n"
