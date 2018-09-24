const session = require('express-session')

const OktaJwtVerifier = require('@okta/jwt-verifier')
const verifier = new OktaJwtVerifier({
  clientId: process.env.OKTA_CLIENT_ID,
  issuer: `${process.env.OKTA_ORG_URL}/oauth2/default`
})

const { Client } = require('@okta/okta-sdk-nodejs')
const client = new Client({
  orgUrl: process.env.OKTA_ORG_URL,
  token: process.env.OKTA_TOKEN
})

const { ExpressOIDC } = require('@okta/oidc-middleware')
const oidc = new ExpressOIDC({
  issuer: `${process.env.OKTA_ORG_URL}/oauth2/default`,
  client_id: process.env.OKTA_CLIENT_ID,
  client_secret: process.env.OKTA_CLIENT_SECRET,
  redirect_uri: `${process.env.HOST_URL}/authorization-code/callback`,
  scope: 'openid profile'
})

const initializeApp = (app) => {
  app.use(session({
    secret: process.env.APP_SECRET,
    resave: true,
    saveUninitialized: false
  }))
  app.use(oidc.router)
  app.use('/access-token', oidc.ensureAuthenticated(), async (req, res, next) => {
    res.send(req.userContext.tokens.access_token)
  })
}

module.exports = { client, verifier, initializeApp }
