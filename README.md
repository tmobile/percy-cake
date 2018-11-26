# YAML EDITOR SETUP

# Prerequisite

- Docker
- Docker Compose
- Node.js 10+



## Build

Build app frontend (which will build in production mode), the static assets are built under `frontend/dist`:

```bash
./docker/build.sh
```



In this build step supports configuration via environment variables, you can refer to `frontend/src/environments/environment.prod.ts`:

| Environment                | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| CORS_PROXY                 | The cors proxy for isomorphic-git                            |
| DEFAULT_BRANCH_NAME        | Default branch name shown in login page                      |
| DEFAULT_REPOSITORY_URL     | Default repository url shown in login page                   |
| LOCKED_BRANCHES            | Locked branches                                              |
| STORE_NAME                 | The browser indexeddb store name                             |
| REPOS_FOLDER               | The browserfs folder to clone repos into                     |
| DRAFT_FOLDER               | The browserfs folder to store draft files                    |
| META_FOLDER                | The browserfs folder contains metadata file                  |
| LOGGED_IN_USERS_METAFILE   | The file name which contains logged in user names            |
| YAML_APPS_FOLDER           | The folder name which contains apps' yaml config             |
| ENVIRONMENTS_FILE          | The environment file name (JUST file name)                   |
| HEALTHCHECK_FILE           | The path to health check file                                |
| LOGIN_SESSION_TIMEOUT      | The login session timeout, like "1m", "2.5 hrs", "2 days". Default to 30m. |
| ENCRYPT_KEY                | The key used to encrypt security information like password   |
| ENCRYPT_SALT               | The salt used to encrypt security information like password  |
| VARIABLE_SUBSTITUTE_PREFIX | The Yaml variable substitute prefix                          |
| VARIABLE_SUBSTITUTE_SUFFIX | The Yaml variable substitute suffix                          |



# Start docker

Run

```bash
docker-compose -f ./docker/docker-compose.yml up --build
```



In this step support 2 configuration, you can refer to `docker/docker-compose.yml` :

| Environment | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| NODE_ENV    | Typically 'production' for production build                  |
| NGINX_PORT  | The nginx server port. The nginx will serve both the static assets in `frontend/dist` and the isomorphic-git proxy. |



Assume `NGINX_PORT` is configured as 8080, then you can visit http://localhost:8080