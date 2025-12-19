FROM nginx:latest

RUN apt-get update && \
    apt-get install -y openssl && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/private.key \
    -out /etc/nginx/ssl/certificate.crt \
    -subj "/C=BR/ST=State/L=City/O=Org/CN=localhost"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html

# Expose HTTP and HTTPS (custom port)
EXPOSE 80 8443
