#!/usr/bin/env bash

installed()
{
	$1 &>/dev/null && return $?
}

echo "--- SHELL PROVISIONING ---"

set -ex # print command before executing
pwd

sudo apt-get update

sudo apt-get -y install git dpkg-repack tree build-essential apt-rdepends

# Install Docker
if ! installed "docker -v"
	then
	sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
	sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
	sudo apt-key fingerprint 0EBFCD88 | grep docker@docker.com || exit 1
	sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
	sudo apt-get update
	sudo apt-get install -y docker-ce
	sudo docker --version
fi

# Install Node.js
if ! installed "node -v"
	then
	curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
	sudo apt-get install -y nodejs

	# Set Node.js version to 6.11.2
	sudo npm install -g n
	sudo n 6.11.2
fi

sudo npm install -g yarn pm2

cd ~
git clone https://github.com/thailekha/dynamic-dockerizer-agent.git
cd dynamic-dockerizer-agent && yarn install && npm run build && DD_AGENT_PATH=$(pwd)

cd ~
git clone https://github.com/thailekha/gantry.git
cd gantry && yarn install && GANTRY_PATH=$(pwd)

cd ~

# sudo mv /tmp/agent_dotenv "$DD_AGENT_PATH/.env"
# sudo mv /tmp/gantry_dotenv "$GANTRY_PATH/.env"

# cwd must be set in order to use .env file
sudo pm2 start $DD_AGENT_PATH/dist/index.js --cwd $DD_AGENT_PATH --name 'dd-agent'
sudo pm2 start $GANTRY_PATH/index.js --cwd $GANTRY_PATH --name 'gantry'

# Make pm2 run dd-agent on startup
sudo pm2 startup
sudo pm2 save

# Useful pm2 commands
# sudo pm2 show dd-agent
# sudo pm2 logs dd-agent
# sudo pm2 delete all