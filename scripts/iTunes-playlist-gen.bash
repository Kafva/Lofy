#!/bin/bash
exitErr(){ echo -e "$1" >&2 ; exit 1; }
usage="usage: $(basename $0) <...>"

while getopts ":h" opt
do
	case $opt in
		h) exitErr "$usage" ;;
		*) exitErr "$usage" ;;
	esac
done

shift $(($OPTIND - 1))

[ -z "$1" ] && exitErr "$usage"

#----------------------------#

musicDir=$HOME/Music/iTunes/iTunes\ Media/Music

# Per artist or album alternative
