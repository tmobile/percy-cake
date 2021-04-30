#!/bin/sh

envsubst '${NGINX_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

nginx

cors-proxy start -d -p 9999

echo "Percy editor is ready and can be accessed at localhost:${NGINX_PORT}"

tail -f /var/log/nginx/access.log