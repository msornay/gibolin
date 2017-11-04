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
	"os"
	"strings"
	"sync"
	"time"

	"google.golang.org/api/option"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"

	"golang.org/x/net/context"

	firebase "firebase.google.com/go"
	firebaseauth "firebase.google.com/go/auth"
)

var (
	rootPath       = flag.String("rootpath", "./music", "Root path to serve from")
	addr           = flag.String("listen.addr", ":3000", "listening address")
	serviceAccount = flag.String("account", "gibolin-service-account.json", "Path to service account file")
	noFirebase     = flag.Bool("no-firebase", false, "mock firebase auth")

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
		newReq := r.WithContext(context.WithValue(r.Context(), "user", token))
		*r = *newReq
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

type TokenMap struct {
	m   sync.RWMutex
	ttl time.Duration

	// token: creation time map
	tokens map[string]time.Time
}

func (tm *TokenMap) IsValid(tok string) bool {
	tm.m.Lock()
	defer tm.m.Unlock()

	creation, ok := tm.tokens[tok]
	if !ok {
		return false
	}
	if time.Since(creation) > tm.ttl {
		return false
	}
	return true
}

func NewTokenMap(ttl time.Duration) *TokenMap {
	return &TokenMap{
		tokens: make(map[string]time.Time),
		ttl:    ttl,
	}
}

func (tm *TokenMap) IssueToken() string {
	b := make([]byte, 16)
	rand.Read(b) // yolo
	tok := base64.RawURLEncoding.EncodeToString(b)

	tm.m.Lock()
	defer tm.m.Unlock()
	tm.tokens[tok] = time.Now()
	return tok
}

func (tm *TokenMap) cleanup() {
	tm.m.Lock()
	defer tm.m.Unlock()
	for tok, creation := range tm.tokens {
		if time.Since(creation) > tm.ttl {
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
	json.NewEncoder(w).Encode(struct {
		Token string `json:"token"`
	}{
		Token: streamTokens.IssueToken(),
	})
}

func StreamTokenHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if !streamTokens.IsValid(token) {
			http.Error(w, "missing or invalid token in query", http.StatusBadRequest)
			return
		}
		h.ServeHTTP(w, r)
	})
}

func playlistHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	dir := *rootPath + "/" + vars["path"]
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
		// XXX(msy) Use FlaC magic instead
		if strings.HasSuffix(name, "flac") {
			fmt.Fprintf(w, "%s\n", name)
		}
	}
}

func main() {
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
	r.Handle("/", FirebaseAuthHandler(authClient, http.HandlerFunc(rootHandler)))
	r.Handle("/list", FirebaseAuthHandler(authClient, http.HandlerFunc(dirListHandler)))
	r.Handle("/list/{dir:.*}", FirebaseAuthHandler(authClient, http.HandlerFunc(dirListHandler)))

	streamTokens = NewTokenMap(1 * time.Hour)
	stop := streamTokens.StartCleanupTask(10 * time.Second)
	r.Handle("/token", FirebaseAuthHandler(authClient, http.HandlerFunc(issueTokenHandler)))

	r.Handle("/audio/{path:.*}/playlist.m3u8", StreamTokenHandler(http.HandlerFunc(playlistHandler)))
	r.Handle("/audio/{path:.*}/{_}", StreamTokenHandler(http.StripPrefix("/audio/", http.FileServer(http.Dir(*rootPath)))))

	allowedHeaders := handlers.AllowedHeaders([]string{"Authorization"})
	allowedMethods := handlers.AllowedMethods([]string{"GET", "HEAD", "OPTIONS"})
	http.ListenAndServe(*addr, handlers.LoggingHandler(os.Stdout, handlers.CORS(allowedHeaders, allowedMethods)(r)))

	close(stop)
}
