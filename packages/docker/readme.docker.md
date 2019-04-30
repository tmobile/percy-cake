# Percy Web app inside a docker container

## Run from Docker

Prerequisite

- Docker
- Docker Compose



Build app (which will build in production mode), the static assets are built under `packages/webapp/dist/build`:

```bash
npm install -g lerna
lerna bootstrap --hoist
lerna run --scope=percy-cake-web-app --stream build:prod

# After build, 4 files will be generated in 'packages/webapp/dist/build':
# favicon.png
# index.html
# percy.bundle.min.js
# percy.conf.json (which is a copy of packages/webapp/src/percy.conf.prod.json)
```



Run docker compose:

```bash
docker-compose -f ./packages/docker/docker-compose.yml up --build
```



In this step supports config the nginx port, you can refer to [docker-compose.yml](docker-compose.yml)  :

| Environment | Description                                                                                                |
|-------------|------------------------------------------------------------------------------------------------------------|
| NGINX_PORT  | The nginx server port. The nginx will serve both the static assets in `dist` and the isomorphic-git proxy. |



Assume `NGINX_PORT` is configured as 8080, then you can visit http://localhost:8080
