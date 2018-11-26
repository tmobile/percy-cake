FROM node:10

RUN apt-get update \
  && apt-get -y install nginx gettext-base \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN npm i -g @isomorphic-git/cors-proxy

Add docker-entrypoint.sh /docker-entrypoint.sh

ADD nginx.conf /etc/nginx/nginx.conf.template

ENTRYPOINT ["/docker-entrypoint.sh"]