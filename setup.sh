#!/bin/bash

TERMINAL_FILE=~/.zshrc

mkdir ~/workplace/kumo-mercury || echo "Already exists"
mkdir ~/workplace/absolution || echo "Already exists"
mkdir ~/workplace/phoenix || echo "Already exists"
mkdir ~/workplace/tutorials || echo "Already exists"
mkdir ~/workplace/quick-fixes || echo "Already exists"

mv ~/.bb_workspace.sh ~/.bb_workspace-backup.sh || echo "File .bb_workspace.sh not found"
wdir="$(dirname "$0")"
cp $wdir/bash/bb_workspace.sh ~/.bb_workspace.sh
chmod +x ~/.bb_workspace.sh

mv $TERMINAL_FILE $TERMINAL_FILE-backup || echo "File .zshrc not found"
wdir="$(dirname "$0")"
cp $wdir/bash/zshrc $TERMINAL_FILE
. $TERMINAL_FILE

# https://docs.aws.amazon.com/corretto/latest/corretto-17-ug/amazon-linux-install.html
JAVA_VERSION=17
sudo yum install java-$JAVA_VERSION-amazon-corretto-devel
echo "export JAVA_HOME=\"/usr/lib/jvm/java-$JAVA_VERSION-amazon-corretto.x86_64\"" >> $TERMINAL_FILE

# https://w.amazon.com/bin/view/VisualStudioCode/Kotlin/
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk version

sdk install gradle
grep gradle $TERMINAL_FILE || echo 'export PATH="$HOME/.sdkman/candidates/gradle/current/bin:$PATH"' >> $TERMINAL_FILE

sdk install maven
grep maven $TERMINAL_FILE || echo 'export PATH="$HOME/.sdkman/candidates/maven/current/bin:$PATH"' >> $TERMINAL_FILE

sdk install kotlin
grep kotlin $TERMINAL_FILE || echo 'export PATH="$HOME/.sdkman/candidates/kotlin/current/bin:$PATH"' >> $TERMINAL_FILE

cd ~

