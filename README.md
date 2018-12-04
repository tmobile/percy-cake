# YAML EDITOR SETUP

# Prerequisite

- Docker
- Docker Compose
- Node.js 10+



## Build

Build app frontend (which will build in production mode), the static assets are built under `frontend/dist`:

```bash
./docker/build.sh

# After build, 3 files will be generated in frontend/dist:
# index.html
# percy.bundle.min.js
# percy.conf.json (which is a copy of frontend/src/percy.conf.prod.json)
```



The [frontend/src/percy.conf.prod.json](frontend/src/percy.conf.prod.json) (which will be copied to `frontend/dist/percy.conf.json`) contains following configurations:

| Variable                 | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| corsProxy                | The cors proxy for isomorphic-git                            |
| defaultBranchName        | Default branch name shown in login page                      |
| defaultRepositoryUrl     | Default repository url shown in login page                   |
| lockedBranches           | Locked branches                                              |
| storeName                | The browser indexeddb store name                             |
| reposFolder              | The browserfs folder to clone repos into                     |
| draftFolder              | The browserfs folder to store draft files                    |
| metaFolder               | The browserfs folder contains metadata file                  |
| repoMetadataVersion      | The repo metdata version (in case the structrure of repo metadata changes, update this version) |
| loggedInUsersMetaFile    | The file name which contains logged in user names            |
| yamlAppsFolder           | The folder name which contains apps' yaml config             |
| environmentsFile         | The environment file name (JUST file name)                   |
| pullTimeout              | The pull timeout, in which case will switch to clone         |
| loginSessionTimeout      | The login session timeout, like "1m", "2.5 hrs", "2 days". Default to 30m. |
| encryptKey               | The key used to encrypt security information like password   |
| encryptSalt              | The salt used to encrypt security information like password  |
| variableSubstitutePrefix | The Yaml variable substitute prefix                          |
| variableSubstituteSuffix | The Yaml variable substitute suffix                          |



# Start docker

Run

```bash
docker-compose -f ./docker/docker-compose.yml up --build
```



In this step supports config the nginx port, you can refer to [docker/docker-compose.yml](docker/docker-compose.yml)  :

| Environment | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| NGINX_PORT  | The nginx server port. The nginx will serve both the static assets in `frontend/dist` and the isomorphic-git proxy. |



Assume `NGINX_PORT` is configured as 8080, then you can visit http://localhost:8080