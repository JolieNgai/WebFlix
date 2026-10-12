FROM nginx:1.28-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html movie.html login.html register.html profile.html navbar.html footer.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
COPY assets /usr/share/nginx/html/assets
COPY docker/config.js /usr/share/nginx/html/js/config.js
EXPOSE 80
