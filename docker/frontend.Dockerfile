FROM nginx:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/ /usr/share/nginx/html/
COPY docker/config.js /usr/share/nginx/html/js/config.js
EXPOSE 80
