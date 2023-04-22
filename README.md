# KibongesUtils

** Describe KibongesUtils here **

## Documentation

Generated documentation for the latest released version can be accessed here:
https://devcentral.amazon.com/ac/brazil/package-master/package/go/documentation?name=KibongesUtils&interface=1.0&versionSet=live

## Development

See instructions in DEVELOPMENT.md


## Setup

```
kinit -f && mwinit -o

mkdir ~/workplace || echo "Already exists"
cd ~/workplace

# https://builderhub.corp.amazon.com/docs/dev-setup/clouddesktop-configure.html
toolbox --version
toolbox install cr brazil-octane batscli ada bemol bones hydra rde brazilcli

. ~/.zshrc

brazil ws create --name utils --force -vs live
cd utils && brazil ws use -p KibongesUtils

chmod +x src/KibongesUtils/setup.sh
./src/KibongesUtils/setup.sh
. ~/.zshrc
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