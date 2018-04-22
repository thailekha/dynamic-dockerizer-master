# Dynamic Dockerizer - Master
![](https://travis-ci.org/thailekha/dynamic-dockerizer-master.svg?branch=master)

*This repository is the Master component, part of the backend of Dynamic Dockerizer - a project that provides a user-friendly interface that helps to clone a VM, convert running processes running in the clone to Docker images, create containers from the images, and manage them. Full reference to all repositories of the project: ![Master](https://github.com/thailekha/dynamic-dockerizer-master), ![Agent](https://github.com/thailekha/dynamic-dockerizer-agent), ![Frontend](https://github.com/thailekha/dynamic-dockerizer-frontend),![Gantry](https://github.com/thailekha/gantry)*

## Usage
Create development environment (Vagrant and Virtualbox required):
```
vagrant up devbox
```
Install Node.js dependencies:
```
yarn install
```
Run:
```
sudo npm start
```
For development:
```
sudo npm run dev
```

*Notice that Master listens on port 8080, but the vagrant vm maps port 8080 to port 8083 on the host*

## Documentation
The API is documented in Swagger which can be found at `http://<hostname>:8083/docs`