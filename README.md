# oauth-app-simple-example
The simple example of NodeJS application with OAuth2 (OpenID) user management flow to communicate with secured STRATO API endpoints. 
This example is using `blockapps-rest` SDK (https://github.com/blockapps/blockapps-rest) as the library of STRATO API wrapper functions and oauth helper functions.

Application with STRATO OAuth user management flow enabled

## What we are going to run:
 - Local STRATO node on port 8080 (http://localhost:8080) with Oauth provider configured
 - This NodeJS application on port 3000 (http://localhost:3000) with OAuth provider configured

> You can also run this app and STRATO node on any remote host and on different ports (even on HTTPS - with additional SSL setup for STRATO node)

## Configure and run

### Required client configuration on OAuth server
 - Client should have the "Reply URL" `http://localhost:3000/callback`
 - Client should have Client ID and Client Secret as credentials
 - Client should have the http://localhost:8080 set up as resource server (see Appendix 1 for Azure AD configuration steps)
 
> Coming soon: The predefined setup with OAuth server hosted by BlockApps
 
### Run STRATO node

On this step we will run the single STRATO node of the latest released version on http://localhost:8080 with OAuth (OpenID) enabled

Prerequisites:
  - OpenID discovery URL (`https://<openid-provider-host>/.../.well-known/openid-configuration`)
  - Docker and docker-compose installed

```
git clone https://github.com/blockapps/strato-getting-started
cd strato-getting-started
HTTP_PORT=8080 \
  NODE_HOST=localhost:8080 \
  OAUTH_JWT_VALIDATION_ENABLED=true \
  OAUTH_JWT_VALIDATION_DISCOVERY_URL=<OPENID_DISCOVERY_URL> \
  ./strato --single
```

STRATO Management dashboard should now be available on `http://localhost:8080` (with default credentials admin/admin)


### Run Simple OAuth Demo App

On this step we will run the Simple OAuth Demo App server on http://localhost:3000 with OAuth (OpenID) enabled

Prerequisites:
  - NodeJS v6+
  - OpenID discovery URL (`https://<openid-provider-host>/.../.well-known/openid-configuration`)
  - Client ID and Client Secret for your client on OAuth server
  
```
git clone https://github.com/blockapps/oauth-app-simple-example
cd oauth-app-simple-example
npm install
```
Now edit `config.yaml` and set this parameters to the values valid for for your OAuth (OpenID) provider client registration:
 - `openIdDiscoveryUrl`
 - `clientId`
 - `clientSecret`
 
The rest of the configurations may remain unchanged.

Run the server:
```
npm start
```

The Application should now be available on `http://localhost:3000` and will redirect you to OAuth (OpenID) provider sign in page if configured correctly.

## How to use app
1. Open http://localhost:3000
2. Sign in with your OAuth (OpenID) provider
3. Click "Get my address" button - you will see the error message saying that the STRATO blockchain account does not exist for your username (email address)
4. Click "Create my key" - this will create the STRATO blockchain account for your username (email address)
5. Click "Get my address" button again to verify your account exists.
6. Now we will create another insecured blockchain address for the test:"transfer token from your address to some other address (create another address AND FAUCET IT through SMD at http://localhost)
  
    - Open STRATO Management Dashboard in browser (http://localhost:8080, default creds `admin/admin`)
    - Go to Accounts tab
    - Click Create User
    - Provide any username and password, hit Create User
    - Click on the new user - you will see the blockchain address does not have any balance available yet
    - Click the Copy to Clipboard button near the account address.
    
7. On the demo application page (http://localhost:3000) paste the address to the "Transfer tokens - To:" field
8. Enter some amount of tokens to be transfered, e.g. 1000. Click "Send Tokens"
9. After the successfult JSON response is received, you can go to STRATO Management Dashboard Accounts page and check if the user you created earlier received the tokens (Update the page)
10. Click Logout to end your session

This steps show how user who signed with third-party OAuth (OpenID) provider can initiate transactions on the blockchain on his behalf without providing private keys or passwords for each transaction.

## Appendix 1: Set up Azure Active Directory to work with STRATO OAuth flow

Different OAuth providers use various names for common OpenID terms. 
Here is the way to set up Azure Active Directory App Registration ("client" in OAuth' terms).

Assuming we deploy STRATO node on `http://localhost:8080` and Application on `http://localhost:3000`
- Two "App Registrations" should be created in Azure AD (App registration "MY APP" should have App registration "STRATO" set as the "resource"):
  - "STRATO" app registration should have:
    - APP ID URI = `http://localhost:8080`
  - "MY APP" application registration should have:
    - APP ID URI = http://localhost:3000
    - Reply URL: `http://localhost:3000/callback`
    - API ACCESS -> Required Permissions -> Add -> Select STRATO node's app registration (type it's name in search if not on the list) -> Check Delegeted permissions on permissions page -> Save
    - Keys -> create `Password` type secret (start typing the name to create) - use the generated key as CLIENT_SECRET for APP deployment. CLIENT_ID is Application ID of the "MY APP".

There is a known bug with Azure setup in third-party software that we are using - this will be solved in one of the nearest releases.
 - Use `https://login.microsoftonline.com/<azure_tenant_id>/v2.0/.well-known/openid-configuration` discovery URL as value for "openIdDiscoveryUrl" parameter in app's config.yaml
 - Use `https://login.microsoftonline.com/<azure_tenant_id>/.well-known/openid-configuration` discovery URL as value for "OAUTH_JWT_VALIDATION_DISCOVERY_URL" variable whn starting STRATO

