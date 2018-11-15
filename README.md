# YAML EDITOR SETUP

# Prerequisite

- Docker
- Docker Compose
- Node.js 10+



## Build

Build app frontend and backend:

```bash
./docker/build.sh
```



# Configuration

You can overwrite default configuration in `docker/docker-compose.yml` 

| Environment         | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| PORT                | The server port. Default to 3000                             |
| API_VERSION         | The api version, used to construct rest api path             |
| LOG_LEVEL           | The log level                                                |
| REPOS_FOLDER        | The folder to clone repos into                               |
| META_FOLDER         | The folder contains metadata file                            |
| YAML_APPS_FOLDER    | The folder name which contains apps' yaml config             |
| ENVIRONMENTS_FILE   | The environment file name (JUST file name)                   |
| HEALTHCHECK_FILE    | The path to health check file                                |
| JWT_SECRET          | The JWT secret                                               |
| JWT_EXPIRES_IN      | The JWT token expires in, like "1m", "2.5 hrs", "2 days". Default to 12 hours. |
| ENCRYPT_KEY         | The key used to encrypt password                             |
| ENCRYPT_SALT        | The salt used to encrypt password                            |
| MAX_PAYLOAD_SIZE    | The max size of JSON request payload. Default to 1M.         |
| EXTERNAL_CONFIG_URL | If exists, app will load external configuration from that URL, otherwise the locally stored `backend/config/ext-config.json` will be used |



# Start docker

Run

```bash
docker-compose -f ./docker/docker-compose.yml up
```

