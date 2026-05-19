FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx expo export --platform web

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

RUN printf "server {\n  listen 80;\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n\n  location / {\n    try_files \$uri \$uri/ /index.html;\n  }\n}\n" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD [\"nginx\", \"-g\", \"daemon off;\"]
