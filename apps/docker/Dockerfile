FROM nginx:1.20-alpine

RUN apk add --no-cache --repository http://nl.alpinelinux.org/alpine/v3.13/main libuv nodejs nodejs-npm

RUN npm i -g @isomorphic-git/cors-proxy

Add docker-entrypoint.sh /docker-entrypoint.sh

ADD nginx.conf /etc/nginx/nginx.conf.template

ENTRYPOINT ["/docker-entrypoint.sh"]