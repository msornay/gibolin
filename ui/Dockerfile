FROM node:22-bookworm

WORKDIR /app

COPY package.json .

RUN npm install

COPY . /app/

RUN npm run build

EXPOSE 3000

CMD [ "npm", "run", "dev" ]
