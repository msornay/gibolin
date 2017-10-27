package main

import (
	"net/http"
	"os"

	"github.com/gorilla/handlers"
)

func main() {
	http.ListenAndServe(
		":8080",
		handlers.LoggingHandler(os.Stdout, http.FileServer(http.Dir("."))),
	)
}
