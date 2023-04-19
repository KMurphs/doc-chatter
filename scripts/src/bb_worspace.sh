#!/bin/bash

# setup_workspace() {
    #!/bin/bash

    WS_PATH=$(pwd)


    read -p "Enter workspace name: " workspace
    # read -p "Enter version set to use: " version_set

    packages=()
    while
      read -p "Enter package name: " package
      packages+=($package)

      [[ "$package" != "" ]]
    do true; done


    brazil ws create -n $workspace # -vs $version_set
    cd $workspace
    brazil setup platform-support && brazil ws use -platform AL2_x86_64

    for item in ${packages[@]}; do
        echo "Pulling Package: $item";
        [ -z "$item" ] || ( brazil ws use --package "$item" ; cd $WS_PATH/$workspace/src/$item/ ; git checkout -b "kibonges-$workspace"; ) # git push --set-upstream origin "kibonges-$workspace")
    done

    brazil ws show
    cd $WS_PATH/$workspace
# }