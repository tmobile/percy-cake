#!/bin/bash

envsubst '${NGINX_PORT}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

nginx

cors-proxy stop

cors-proxy start -d -p 9999

tail -f /var/log/nginx/access.log