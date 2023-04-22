#!/bin/bash

# https://builderhub.corp.amazon.com/docs/dev-setup/clouddesktop-configure.html
toolbox --version
toolbox install cr brazil-octane batscli ada bemol bones hydra rde

mv ~/.bb_worspace.sh ~/.bb_worspace-backup.sh || echo "File .bb_worspace.sh not found"
wdir="$(dirname "$0")"
cp $wdir/bash/bb_worspace.sh ~/.bb_worspace.sh
chmod +x ~/.bb_worspace.sh

mv ~/.zshrc ~/.zshrc-backup || echo "File .zshrc not found"
wdir="$(dirname "$0")"
cp $wdir/bash/zshrc ~/.zshrc
. ~/.zshrc

cd ~

mkdir ~/workplace/kumo-mercury || echo "Already exists"
mkdir ~/workplace/absolution || echo "Already exists"
mkdir ~/workplace/phoenix || echo "Already exists"
mkdir ~/workplace/tutorials || echo "Already exists"
mkdir ~/workplace/quick-fixes || echo "Already exists"
