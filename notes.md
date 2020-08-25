## [Authorization](https://developer.spotify.com/documentation/general/guides/authorization-guide/)
There are two kinds of authorization for the spotify platform

1. *App authorization*: Access to the SDK and widgets from spotify
2. *User authoriztion*: This is required for calls to the spotify web API which utilises OAuth2, a protocol where the client
communicates with both the app and the spotify server to aquire an *access-token* to be used in future requests.

*Scopes* enable the applciation to use specific REST endpoints at `api.spotify` on behalf of the user.

There are **4** different authorization flows that can be used to authorize a user within an application, we will look at a *refreshable* method.

### [Authorization Code Flow](https://github.com/spotify/web-api-auth-examples)
This is suitable for applications where the user only needs to give permisssion once and generates a *refreshable* token.

1. Request authorization to access user data. This is done by sending a request to `accounts.spotify` with the *clientID* (for our app) and the `redirect-uri` which points to the callback which the user will be redirected to once they authenticate with their credentials. (note that redirect-uris need to be explictily whitelisted)

In practice this is done with a GET request akin to:

```
	GET https://accounts.spotify.com/authorize?client_id=5fe01282e44241328a84e7c5cc169165&response_type=code&redirect_uri=https%3A%2F%2Fexample.com%2Fcallback&scope=user-read-private%20user-read-email&state=34fFs29kd09

```

2. In the callback the application will request an **access-token** and a **refresh-token** from spotify, this request will contain the applications **client-secret** as proof that the app isn't spoofed. The spotify server will return the tokens if the request data is valid. Note that the *access-token* will expire after at which point the refresh token is used.
3. The application can now use the REST API at the **spotify-web-api** with the access-token included in each request



