# Gibolin


## Installing the firebase app

    $ sudo npm install -g firebase-tools $ firebase login $ firebase deploy

## Running nginx

    docker run -p 8080:80 -v $(pwd)/static:/usr/share/nginx/html nginx
