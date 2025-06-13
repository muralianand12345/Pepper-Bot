FROM node:22-slim

WORKDIR /app

COPY package.json ./

RUN yarn global add typescript

COPY . .

RUN yarn install --frozen-lockfile && yarn build

RUN mkdir -p logs

CMD ["node", "build/index.js"]