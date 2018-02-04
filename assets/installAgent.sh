#!/usr/bin/env bash

echo "--- SHELL PROVISIONING ---"

set -ex # print command before executing
pwd

# Install Docker
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo apt-key fingerprint 0EBFCD88 | grep docker@docker.com || exit 1
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
sudo apt-get update
sudo apt-get install -y docker-ce
sudo docker --version
sudo docker pull ubuntu:14.04

sudo apt-get -y install git dpkg-repack tree build-essential apt-rdepends

# Install Node.js
curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
sudo apt-get install -y nodejs

# Set Node.js version to 6.11.2
sudo npm install -g n
sudo n 6.11.2
sudo npm install -g yarn

cd ~
git clone https://github.com/thailekha/dynamic-dockerizer-agent.git
cd dynamic-dockerizer-agent && yarn install
# APP_PATH=pwd

# # Configure the OS to run the app at startup
# sudo echo "cd $APP_PATH/dynamic-dockerizer-agent && npm start" > /etc/rc.local

cd ~/dynamic-dockerizer-agent
sudo npm start &