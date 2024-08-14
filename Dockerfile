FROM node:20-bullseye-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g yarn

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000

COPY start.sh /usr/src/app/start.sh
RUN chmod +x /usr/src/app/start.sh

CMD ["/bin/bash", "/usr/src/app/start.sh"]