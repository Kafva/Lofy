#!/bin/bash
exitErr(){ echo -e "$1" >&2 ; exit 1; }
usage="usage: $(basename $0) [-hi] [-m directory]"
helpStr="\t-i\tCreate a playlist file for each artist in iTunes\n\t-m\tDirectory with audio files to create playlist from"

while getopts ":him:" opt
do
	case $opt in
		h) exitErr "$usage\n$helpStr" ;;
		i) musicDir="$HOME/Music/iTunes/iTunes Media/Music" ;; 
		m) musicDir="$OPTARG" ;;
		*) exitErr "$usage" ;;
	esac
done

shift $(($OPTIND - 1))

[ -z "$musicDir" ] && exitErr "$usage"

#----------------------------#

tmpFile=_playlist

mkdir -p playlists

oldIFS="$IFS"
IFS=$'\n'

if [ "$musicDir" =  "$HOME/Music/iTunes/iTunes Media/Music" ]; then
	
	for artist in $(find "$musicDir" -depth 1 -type d); do
	# The iTunes directory orders tracks by Artist > Album
		rm -f /tmp/$tmpFile
		artistName=$(basename "$artist")
		[ $artistName = "Music" ] && continue

		echo "=========== $artistName ================"
		
		for track in $(find "$artist" -depth 2 -type f); do
			file "$track" | grep -qi "audio" && {
				
				printf "%s\n" "$track" >> /tmp/$tmpFile
			}
		done

		sort /tmp/$tmpFile > ./playlists/"$artistName".txt
	done
else
	dirName=$(basename "$musicDir")
	for track in $(find "$musicDir" -depth 1 -type f); do
		file "$track" | grep -qi "audio" && {
			printf "%s\n" "$track" >> /tmp/$tmpFile
		}
	done

	[ -f /tmp/$tmpFile ] && sort /tmp/$tmpFile > ./playlists/"$dirName".txt
fi


IFS=$oldIFS
