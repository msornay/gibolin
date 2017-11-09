package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang/glog"
	"google.golang.org/api/option"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"

	"golang.org/x/net/context"

	firebase "firebase.google.com/go"
	firebaseauth "firebase.google.com/go/auth"
)

var (
	rootPath       = flag.String("rootpath", "./music", "Root path to serve from")
	baseUrl        = flag.String("base-url", "http://localhost:3000", "Base URL that should appear in playlists")
	addr           = flag.String("listen.addr", ":3000", "listening address")
	serviceAccount = flag.String("account", "gibolin-service-account.json", "Path to service account file")
	// noFirebase     = flag.Bool("no-firebase", false, "mock firebase auth")

	streamTokens *TokenMap
)

func getAuthHeader(r *http.Request) (string, error) {
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

func FirebaseAuthHandler(authClient *firebaseauth.Client, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idToken, err := getAuthHeader(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		token, err := authClient.VerifyIDToken(idToken)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		r = r.WithContext(context.WithValue(r.Context(), "user", token))
		h.ServeHTTP(w, r)
	})
}

func rootHandler(w http.ResponseWriter, r *http.Request) {
	userInfo := r.Context().Value("user").(*firebaseauth.Token)
	msg := "Welcome " + userInfo.Claims["name"].(string)
	w.Write([]byte(msg))
}

type File struct {
	Name string `json:"name"`
	Dir  bool   `json:"dir"`
}

func dirListHandler(w http.ResponseWriter, r *http.Request) {
	var toList []File
	vars := mux.Vars(r)
	dir := *rootPath + "/" + vars["dir"]
	files, err := ioutil.ReadDir(dir)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	for _, file := range files {
		f := &File{
			Name: file.Name(),
			Dir:  file.IsDir(),
		}
		toList = append(toList, *f)
	}
	json.NewEncoder(w).Encode(toList)
}

type TokenMapEntry struct {
	Created time.Time
	Path    string
}

type TokenMap struct {
	m   sync.RWMutex
	ttl time.Duration

	// token: creation time map
	tokens map[string]TokenMapEntry
}

func (tm *TokenMap) GetPath(tok string) (string, error) {
	tm.m.Lock()
	defer tm.m.Unlock()

	v, ok := tm.tokens[tok]
	if !ok {
		return "", errors.New("token not found")
	}
	if time.Since(v.Created) > tm.ttl {
		return "", errors.New("token expired")
	}
	return v.Path, nil
}

func NewTokenMap(ttl time.Duration) *TokenMap {
	return &TokenMap{
		tokens: make(map[string]TokenMapEntry),
		ttl:    ttl,
	}
}

func (tm *TokenMap) IssueToken(path string) string {
	b := make([]byte, 16)
	rand.Read(b) // yolo
	tok := base64.RawURLEncoding.EncodeToString(b)

	tm.m.Lock()
	defer tm.m.Unlock()
	tm.tokens[tok] = TokenMapEntry{
		Created: time.Now(),
		Path:    path,
	}

	return tok
}

func (tm *TokenMap) cleanup() {
	tm.m.Lock()
	defer tm.m.Unlock()
	for tok, v := range tm.tokens {
		if time.Since(v.Created) > tm.ttl {
			delete(tm.tokens, tok)
		}
	}
}

func (tm *TokenMap) StartCleanupTask(t time.Duration) chan<- struct{} {
	ticker := time.NewTicker(t)
	quit := make(chan struct{})
	go func() {
		for {
			select {
			case <-ticker.C:
				tm.cleanup()
			case <-quit:
				ticker.Stop()
				return
			}
		}
	}()
	return quit
}

func issueTokenHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	path, ok := vars["path"]
	if !ok || path == "" {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	_, err := os.Stat(*rootPath + "/" + path)
	if err != nil {
		if glog.V(1) {
			glog.Infof("cannot stat: %s", path)
		}
		http.Error(w, "ressource not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(struct {
		Token string `json:"token"`
	}{
		Token: streamTokens.IssueToken(path),
	})
}

func TokenHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		_, err := streamTokens.GetPath(token)
		if err != nil {
			http.Error(w, "missing or invalid token in query", http.StatusBadRequest)
			return

		}
		h.ServeHTTP(w, r)
	})
}

func playlistHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	token, ok := vars["token"]
	if !ok || token == "" {
		http.Error(w, "invalid token", http.StatusBadRequest)
		return
	}

	path, err := streamTokens.GetPath(token)
	if err != nil {
		http.Error(w, "playlist not found", http.StatusNotFound)
		return
	}

	// url.PathEscape() each path component
	var parts []string
	for _, p := range strings.Split(path, "/") {
		parts = append(parts, url.PathEscape(p))
	}
	escPath := strings.Join(parts, "/")

	files, err := ioutil.ReadDir(*rootPath + "/" + path)
	if err != nil {
		glog.Errorf("error reading directory: %s", err)
		http.Error(w, "error reading directory", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "audio/mpegurl; charset=utf-8")

	// VLC seems to like this
	fmt.Fprintln(w, "#EXTM3U")

	for _, f := range files {
		name := f.Name()
		// XXX(msy) Use FlaC magic instead
		if strings.HasSuffix(name, "flac") {
			loc := *baseUrl + "/audio/" + escPath + "/" + url.PathEscape(name) + "?token=" + token
			if glog.V(1) {
				glog.Infof("playlist item: %s", loc)
			}
			fmt.Fprintln(w, loc)
		}
	}
}

// func zipHandler(w http.ResponseWriter, r *http.Request) {
// 	vars := mux.Vars(r)
// 	path, ok := vars["path"]
// 	if !ok || path == "" {
// 		http.Error(w, "invalid path", http.StatusBadRequest)
// 		return
// 	}
//
// 	dir := *rootPath + "/" + path
// 	f, _ := os.Open(dir)
// 	dirs, err := f.Readdir(-1)
// 	f.Close()
// 	if err != nil {
// 		http.Error(w, "Error reading directory", http.StatusInternalServerError)
// 		return
// 	}
//
// 	w.Header().Set("Content-Type", "application/zip")
// 	z := zip.NewWriter(w)
// 	defer z.Close()
// 	for _, d := range dirs {
// 		zf, err := z.Create(d.Name())
// 		if err != nil {
// 			http.Error(w, "cannot create zip file", http.StatusInternalServerError)
// 			return
// 		}
//
// 		// XXX(msy) Use FlaC magic instead
// 		if strings.HasSuffix(name, "flac") {
// 			fmt.Fprintf(w, "%s?token=%s\n", name, token)
// 		}
// 	}
//
// }

func main() {
	flag.Parse()

	opt := option.WithCredentialsFile(*serviceAccount)
	app, err := firebase.NewApp(context.Background(), nil, opt)
	if err != nil {
		glog.Fatalf("error initializing app: %v\n", err)
	}

	authClient, err := app.Auth(context.Background())
	if err != nil {
		glog.Fatalf("error getting Auth client: %v\n", err)
	}

	r := mux.NewRouter()
	r.Handle("/", FirebaseAuthHandler(authClient, http.HandlerFunc(rootHandler)))
	r.Handle("/list", FirebaseAuthHandler(authClient, http.HandlerFunc(dirListHandler)))
	r.Handle("/list/{dir:.*}", FirebaseAuthHandler(authClient, http.HandlerFunc(dirListHandler)))

	streamTokens = NewTokenMap(1 * time.Hour)
	stop := streamTokens.StartCleanupTask(10 * time.Second)
	r.Handle("/token/{path:.*}", FirebaseAuthHandler(authClient, http.HandlerFunc(issueTokenHandler)))

	r.Handle("/m3u8/{token}", http.HandlerFunc(playlistHandler))
	// r.Handle("/zip/token", FirebaseAuthHandler(http.StripPrefix("/zip/", http.HandlerFunc(zipHandler))))

	r.Handle("/audio/{path:.*}/{_}", TokenHandler(http.StripPrefix("/audio/", http.FileServer(http.Dir(*rootPath)))))

	allowedHeaders := handlers.AllowedHeaders([]string{"Authorization"})
	allowedMethods := handlers.AllowedMethods([]string{"GET", "HEAD", "OPTIONS"})

	defer close(stop)

	glog.Info("Listening on", *addr)
	log.Fatal(http.ListenAndServe(*addr, handlers.LoggingHandler(os.Stdout, handlers.CORS(allowedHeaders, allowedMethods)(r))))
}
