#!/bin/bash

mv ~/.zshrc ~/.zshrc-backup || echo "File .zshrc not found"
wdir="$(dirname "$0")"
cp $wdir/src/zshrc ~/.zshrc
