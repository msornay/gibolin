function displayError(errorMessage) {
    e  = document.getElementById('error');
    e.textContent = errorMessage;
    e.style.display = "block";
}

initApp = function() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // User is signed in.
            var apiAddr = "http://localhost:3000";
            var displayName = user.displayName;
            user.getIdToken().then(function(accessToken) {
                document.getElementById('sign-in-status').textContent = 'Signed in as: '+user.email;
                Vue.component('dir-item', {
                    template: '#dir-template',
                    props: ['title'],
                    data: function () {
                        return {
                            open: false,
                            albumList: [],
                        }
                    },
                    methods: {
                        toggle: function (){
                            this.open = !this.open;
                            this.$http.get(apiAddr+'/list/'+this.title).then(response => {
                                this.albumList = JSON.parse(response.body);
                            }, response => {
                                displayError("Cannot fetch alum for"+serie);
                                console.log("Cannot fetch album for "+serie);
                            });
                        }
                    },
                })

                Vue.component('album-item', {
                    template: '#album-template',
                    props: ['serie', 'album'],
                    data: function () {
                        return {
                            open: false,
                            m3u8Text: "m3u8",
                            m3u8Link: null,
                            showCopyModal: false,
                        }
                    },
                    methods: {
                        toggle: function (){
                            this.open = !this.open;
                        },
                        generateLink: function () {
                            if (!this.m3u8Link) {
                                this.$http.get(apiAddr+'/token/'+this.serie+'/'+this.album).then(response => {
                                    token = JSON.parse(response.body).token;
                                    this.m3u8Link = apiAddr+"/m3u8/"+token;
                                }, response => {
                                    displayError("Cannot get token from server");
                                    console.log("Cannot get token from server");
                                });
                            }
                            this.showCopyModal = true
                        },
                    },
                })
                Vue.component('modal', {
                    template: '#modal-template',
                    props: ['link'],
                    methods: {
                        // Copy link to clipboard
                        copyLink: function() {
                            this.$refs.link.select();
                            document.execCommand('copy');
                        },
                    }
                })
                Vue.http.headers.common['Authorization'] = 'Bearer '+accessToken;
                var rootListVue = new Vue({
                    el: '#root',
                    data: {
                        rootList: [],
                    },
                    created: function () {
                        console.log('app created')
                            this.getCatalog();
                    },
                    methods: {
                        getCatalog: function () {
                            this.$http.get(apiAddr+'/list/').then(response => {
                                this.rootList = JSON.parse(response.body);
                            }, response => {
                                displayError("Cannot list root directory");
                            });
                        },
                    }
                });
            });
        } else {
            // User is signed out.
            document.location.href = '/login.html';
        }
    }, function(error) {
        console.log(error);
    });
};

window.addEventListener('load', function() {
    initApp()
});

