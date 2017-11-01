package main

import (
    "net/http"
    "os"
    "log"
    "strings"
    "errors"
    "flag"
	"github.com/gorilla/handlers"
    "github.com/gorilla/mux"

    "golang.org/x/net/context"

    firebase "firebase.google.com/go"
    firebaseauth "firebase.google.com/go/auth"

    "google.golang.org/api/option"
)

type TokenVerifier struct {
    Auth firebaseauth.Client
}

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

func (t *TokenVerifier) Handler(h http.Handler) http.Handler {
    return http.HandlerFunc(func (w http.ResponseWriter, r *http.Request) {
        authClient := t.Auth
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

    tokenVerifier := &TokenVerifier {
        Auth: *authClient,
    }

    r := mux.NewRouter()
    r.Handle("/", tokenVerifier.Handler(rootHandler))
    http.ListenAndServe(*addr, handlers.LoggingHandler(os.Stdout, r))
}
