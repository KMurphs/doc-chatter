#!/bin/bash

TERMINAL_FILE_TEMPLATE=zshrc
TERMINAL_FILE=.$TERMINAL_FILE_TEMPLATE
BB_WS_FILE=bb_workspace.sh

wdir="$(dirname "$0")"
wdir=$(dirname -- "$( readlink -f -- "$0"; )";)
echo Script Directory: $wdir

mkdir /tmp || echo "Already exists"
cd /tmp
mkdir tmp || echo "Already exists"
cd tmp

mkdir /workplace/kibonges/kumo-mercury || echo "Already exists"
mkdir /workplace/kibonges/absolution || echo "Already exists"
mkdir /workplace/kibonges/phoenix || echo "Already exists"
mkdir /workplace/kibonges/tutorials || echo "Already exists"
mkdir /workplace/kibonges/quick-fixes || echo "Already exists"

mv ~/.$BB_WS_FILE ~/.bb_workspace-backup.sh || echo "File .$BB_WS_FILE not found"
cp $wdir/bash/$BB_WS_FILE ~/.$BB_WS_FILE
chmod +x ~/.$BB_WS_FILE

mv ~/$TERMINAL_FILE ~/$TERMINAL_FILE-backup || echo "File $TERMINAL_FILE not found"
cp $wdir/bash/$TERMINAL_FILE_TEMPLATE ~/$TERMINAL_FILE
source ~/$TERMINAL_FILE

echo ~/$TERMINAL_FILE

# https://builderhub.corp.amazon.com/docs/brazil/cli-guide/setup-clouddesk.html
brazil setup completion
sudo mkdir -p -m 755 /workplace/${USER}
sudo chown -R ${USER}:amazon /workplace/${USER}
ln -s /workplace/${USER} ~/workplace

# https://docs.aws.amazon.com/corretto/latest/corretto-17-ug/amazon-linux-install.html
JAVA_VERSION=17
sudo yum install java-$JAVA_VERSION-amazon-corretto-devel
echo "export JAVA_HOME=\"/usr/lib/jvm/java-$JAVA_VERSION-amazon-corretto.x86_64\"" >> ~/$TERMINAL_FILE
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/$TERMINAL_FILE


# https://w.amazon.com/bin/view/VisualStudioCode/Kotlin/
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk version

sdk install gradle
grep gradle ~/$TERMINAL_FILE || echo 'export PATH="$HOME/.sdkman/candidates/gradle/current/bin:$PATH"' >> ~/$TERMINAL_FILE

sdk install maven
grep maven ~/$TERMINAL_FILE || echo 'export PATH="$HOME/.sdkman/candidates/maven/current/bin:$PATH"' >> ~/$TERMINAL_FILE

sdk install kotlin
grep kotlin ~/$TERMINAL_FILE || echo 'export PATH="$HOME/.sdkman/candidates/kotlin/current/bin:$PATH"' >> ~/$TERMINAL_FILE


curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

kinit && mwinit -o

function mcurl() {
    /usr/bin/curl "$@" -L --cookie ~/.midway/cookie --cookie-jar ~/.midway/cookie
}

# https://w.amazon.com/bin/view/VisualStudioCode/Viceroy/
mcurl "https://code.amazon.com/packages/Viceroy/releases/1.0/latest_artifact?version_set=Viceroy/release&path=ext/vscode-brazil.vsix&download=true" -o "vscode-brazil-viceroy.vsix" -L 

# https://builderhub.corp.amazon.com/docs/black-caiman/user-guide/getting-started.html#download
mcurl "https://prod.artifactbrowser.brazil.aws.dev/api/v1/packages/IntelliJPluginRepositoryAuth/versions/2023.2.177.0/platforms/AL2_x86_64/flavors/DEV.STD.PTHREAD/distributions/amazon-auth-2023.2.zip" -o "amazon-auth-2023.2.zip" -L 
mcurl "https://prod.artifactbrowser.brazil.aws.dev/api/v1/packages/BlackCaiman/versions/2023.2.363.0/platforms/AL2_x86_64/flavors/DEV.STD.PTHREAD/intellij-plugins/BlackCaiman-2023.2.zip" -o "BlackCaiman-2023.2.zip" -L 

cd ~

