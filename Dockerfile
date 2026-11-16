FROM nginx:stable-alpine

COPY index.html favicon.svg favicon.png apple-touch-icon.png og.png /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
COPY sounds/ /usr/share/nginx/html/sounds/

EXPOSE 80
