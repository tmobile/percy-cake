# Percy Web app inside a docker container

## Run from Docker

Prerequisite

- Docker
- Docker Compose



Build app (which will build in production mode), the static assets are built under `dist/build`:

```bash
./docker/build.sh

# After build, 3 files will be generated in 'dist/build':
# index.html
# percy.bundle.min.js
# percy.conf.json (which is a copy of src/percy.conf.prod.json)
```



Run docker compose:

```bash
docker-compose -f ./docker/docker-compose.yml up --build
```



In this step supports config the nginx port, you can refer to [docker/docker-compose.yml](docker/docker-compose.yml)  :

| Environment | Description                                                                                                |
|-------------|------------------------------------------------------------------------------------------------------------|
| NGINX_PORT  | The nginx server port. The nginx will serve both the static assets in `dist` and the isomorphic-git proxy. |



Assume `NGINX_PORT` is configured as 8080, then you can visit http://localhost:8080
