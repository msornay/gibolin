FROM golang:latest
RUN mkdir /app
ADD ./*.go /app/
WORKDIR /app

RUN go get github.com/golang/glog
RUN go get github.com/gorilla/handlers
RUN go get github.com/gorilla/mux
RUN go get firebase.google.com/go

RUN go build -o gibolin-server .
CMD ["/app/gibolin-server --rootpath $GBL_ROOT --mp3path $GBL_MP3 \
--base-url $GBL_URL --account $GBL_ACCOUNT_FILE \
--whitelist $GBL_WHITELIST"]
