FROM nginx:1.15

RUN apt-get update \
  && apt-get -y install wget gnupg \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN wget https://deb.nodesource.com/setup_10.x && chmod +x setup_10.x

RUN ./setup_10.x

RUN apt-get install -y nodejs && apt-get clean

RUN npm i -g @isomorphic-git/cors-proxy

Add docker-entrypoint.sh /docker-entrypoint.sh

ADD nginx.conf /etc/nginx/nginx.conf.template

ENTRYPOINT ["/docker-entrypoint.sh"]