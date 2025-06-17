# KibongesUtils

** Describe KibongesUtils here **

## Documentation

Generated documentation for the latest released version can be accessed here:
https://devcentral.amazon.com/ac/brazil/package-master/package/go/documentation?name=KibongesUtils&interface=1.0&versionSet=live

## Development

See instructions in DEVELOPMENT.md


## Setup

```

mwinit -o

mkdir ~/workplace || echo "Already exists"
cd ~/workplace

# https://builderhub.corp.amazon.com/docs/dev-setup/clouddesktop-configure.html
toolbox --version
toolbox install cr brazil-octane batscli ada bemol bones hydra rde brazilcli axe q

mwinit -o --preregister
# Follow https://w.amazon.com/bin/view/NextGenMidway/UserGuide/OTPSoftwareCertificate/ at the prompt
axe doctor connection # https://docs.hub.amazon.dev/axe/user-guide/cxrx/

. ~/.zshrc

brazil ws create --name utils --force -vs live
cd utils && brazil ws use -p KibongesUtils

chmod +x src/KibongesUtils/setup.sh
./src/KibongesUtils/setup.sh
. ~/.zshrc

mkdir -p /tmp/tmp

```

## IDEs

- Info: https://quip-amazon.com/l2caALaaa7ed/Working-with-Kotlin#temp:C:SRDce9e8c8f747d4804a9dc8c19e

- BlackCaiman: https://docs.hub.amazon.dev/black-caiman/user-guide/getting-started/
- Bemol: https://w.amazon.com/bin/view/Bemol#HInstallation
- Viceroy: https://w.amazon.com/bin/view/VisualStudioCode/Viceroy
- JDKs, Kotlin, Maven, Gradle: https://w.amazon.com/bin/view/VisualStudioCode/Kotlin/#HInstructions

## Copy files from MAC to Remote

```
scp /path/to/local/file username@remote_host:/path/to/remote/directory
scp /Users/kibonges/Downloads/com.amazon.ijbp-3.0.1514.242.zip kibonges@cdb:/tmp/tmp
scp /Users/kibonges/Downloads/com.amazon.intellij.plugin.repository.auth-2024.2.1514.242.zip kibonges@cdb:/tmp/tmp
```


### SSH Shortcut 
```
# https://builderhub.corp.amazon.com/docs/cloud-desktop/user-guide/logging-in.html#set-up-a-ssh-shortcut-optional
ls ~/.ssh/config

# If this file is not present
# mkdir ~/.ssh
# touch ~/.ssh/config
# chmod 600 ~/.ssh/config

# Add entries
Host cd2
   HostName <dev-desktop-dns-name>
   User kibonges

# try logging in
ssh cd2
```