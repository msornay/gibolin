package main

import (
    "net/http"
    "os"
    "log"
    "strings"
    "errors"
    "flag"
    "io/ioutil"
    "fmt"
    "encoding/json"

    "github.com/gorilla/handlers"
    "github.com/gorilla/mux"

    "golang.org/x/net/context"

    firebase "firebase.google.com/go"
    firebaseauth "firebase.google.com/go/auth"

    "google.golang.org/api/option"
)

var rootPath = flag.String("rootpath", "./music", "Root path to serve from")

func GetAuthHeader(r *http.Request) (string, error) {
    authHeader := r.Header.Get("Authorization")
    if authHeader == "" {
        return "", nil
    }

    authHeaderSplit := strings.Split(authHeader, " ")
    if len(authHeaderSplit) != 2 || strings.ToLower(authHeaderSplit[0]) != "bearer" {
        return "", errors.New("Authorization header format must be Bearer {token}")
    }
    return authHeaderSplit[1], nil
}

func SecureHandler(h http.Handler, authClient *firebaseauth.Client) http.Handler {
    return http.HandlerFunc(func (w http.ResponseWriter, r *http.Request) {
        idToken, err := GetAuthHeader(r)
        if err != nil {
            http.Error(w, err.Error(), http.StatusUnauthorized)
            return
        }
        token, err := authClient.VerifyIDToken(idToken)
        if err != nil {
            http.Error(w, err.Error(), http.StatusUnauthorized)
            return
        }
        newReq := r.WithContext(context.WithValue(r.Context(), "user", token))
        *r = *newReq
        h.ServeHTTP(w, r)
    })
}

var rootHandler = http.HandlerFunc(func (w http.ResponseWriter, r *http.Request){
    userInfo := r.Context().Value("user").(*firebaseauth.Token)
    msg := "Welcome "+userInfo.Claims["name"].(string)
    w.Write([]byte(msg))
})

type File struct {
    Name  string `json:"name"`
    Dir   bool   `json:"dir"`
}

var dirListHandler = http.HandlerFunc(func (w http.ResponseWriter, r *http.Request){
    var toList []File
    vars := mux.Vars(r)
    dir := *rootPath+"/"+vars["dir"]
    files, err := ioutil.ReadDir(dir)
    if err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    for _, file  := range files {
        f := &File {
            Name: file.Name(),
            Dir: file.IsDir(),
        }
        toList = append(toList, *f)
    }
    json.NewEncoder(w).Encode(toList)
})


var playlistHandler = http.HandlerFunc(func (w http.ResponseWriter, r *http.Request) {
    vars := mux.Vars(r)
    dir := *rootPath+"/"+vars["path"]
    f, _ := os.Open(dir)
    defer f.Close()
    dirs, err := f.Readdir(-1)
    if err != nil {
        http.Error(w, "Error reading directory", http.StatusInternalServerError)
        return
    }
    w.Header().Set("Content-Type", "audio/mpegurl; charset=utf-8")
    for _, d := range dirs {
        name := d.Name()
        if strings.HasSuffix(name, "flac") {
            fmt.Fprintf(w, "%s\n", name)
        }
    }
})

func main() {
    var (
        addr = flag.String("listen.addr", ":3000", "listening address")
        serviceAccount = flag.String("account", "gibolin-service-account.json", "Path to service account file")
    )
    flag.Parse()

    opt := option.WithCredentialsFile(*serviceAccount)
    app, err := firebase.NewApp(context.Background(), nil, opt)
    if err != nil {
        log.Fatalf("error initializing app: %v\n", err)
    }

    authClient, err := app.Auth(context.Background())
    if err != nil {
        log.Fatalf("error getting Auth client: %v\n", err)
    }

    r := mux.NewRouter()
    r.Handle("/", SecureHandler(rootHandler, authClient))
    r.Handle("/list", SecureHandler(dirListHandler, authClient))
    r.Handle("/list/{dir:.*}", SecureHandler(dirListHandler, authClient))
    r.Handle("/audio/{path:.*}/playlist.m3u8", playlistHandler)
    r.Handle("/audio/{path:.*}/{_}", http.StripPrefix("/audio/", http.FileServer(http.Dir(*rootPath))))
    http.ListenAndServe(*addr, handlers.LoggingHandler(os.Stdout, r))
}
