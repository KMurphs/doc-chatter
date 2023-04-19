#!/bin/bash


mv ~/.bb_worspace.sh ~/.bb_worspace-backup.sh || echo "File .bb_worspace.sh not found"
wdir="$(dirname "$0")"
cp $wdir/src/bb_worspace.sh ~/.bb_worspace.sh
chmod +x ~/.bb_worspace.sh

mv ~/.zshrc ~/.zshrc-backup || echo "File .zshrc not found"
wdir="$(dirname "$0")"
cp $wdir/src/zshrc ~/.zshrc
. ~/.zshrc