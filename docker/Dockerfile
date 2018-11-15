FROM node:10

RUN git config --global user.email "admin@percy.com"
RUN git config --global user.name "Admin"

WORKDIR /percy-app/backend

EXPOSE $PORT

CMD ["npm", "start"]
