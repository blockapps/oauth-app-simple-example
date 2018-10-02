# oauth-app-simple-example
The dummy example of NodeJS application with implemented OAuth2 flow to communicate with secured STRATO API endpoints. This example is using the plain API calls. For example using blockapps-rest SDK - refer to another example (coming soon)

Requirements: 
  - STRATO v4.1+

Application with OAuth2 flow enabled

1. How to configure:
  Assuming we deploy STRATO node on `http://localhost` and Application on `http://localhost:3000` (other URLs will also work as well as https(with additional ssl setup for STRATO))
  - Two "App Registrations" should be created in Azure AD (App registration "MY APP" should have App registration "STRATO" set as the "resource"):
    - "STRATO" app registration should have:
      - APP ID URI = `http://localhost`
    - "MY APP" application registration should have:
      - APP ID URI = http://localhost:3000
      - Reply URLs: `http://localhost:3000/callback`, `http://localhost:3000/auth/confirm`
      - API ACCESS -> Required Permissions -> Add -> Select STRATO node's app registration -> Check Delegeted permissions on permissions page -> Save
      - Keys -> create `Password` type secret (start typing the name to create) - use these credentials for APP deployment
  - Application config and deployment (on `http://localhost:3000`)
    - Provide STRATO_URL (`http://localhost`), CLIENT_ID and CLIENT_SECRET (from Azure AD step) and provide the proper tenant ID in the URLs under auth object (tenant ID is the organization ID on Azure)
  - STRATO node deployment (on http://localhost) (with `OAUTH_JWT_VALIDATION_ENABLED=true` and `OAUTH_JWT_VALIDATION_DISCOVERY_URL=https://login.microsoftonline.com/<tenant_id>/v2.0/.well-known/openid-configuration` vars provided (same tenant id that we use for App deployment ))

2. Run
  - `npm i`
  - set your configurations in `config.json`
  - `npm run start`
  - open `http://localhost:3000` in browser (Incognito mode may be a good idea in case you are logged in with OAuth provider in your browser)
  - login
  - create new account
  - get the address
  - transfer token from your address to some other address (create another address AND FAUCET IT through SMD at http://localhost)
