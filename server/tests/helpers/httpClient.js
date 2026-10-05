// Shared – test helper: starts the Express app on a free port and signs in like the browser does
// (POST /api/auth/login, then sends the session cookie with every request).
const app = require('../../src/app')
const { TEST_PASSWORD } = require('./testDatabase')

const startServer = () => new Promise(resolve => {
  const server = app.listen(0, () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }))
})

// A tiny API client. Every call resolves to { status, body }.
const makeClient = (baseUrl, cookie = null) => {
  const request = async (method, path, body) => {
    const response = await fetch(baseUrl + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    const text = await response.text()
    let parsed = text
    try { parsed = text ? JSON.parse(text) : null } catch { /* keep text */ }
    return { status: response.status, body: parsed }
  }
  return {
    cookie, // for raw fetch() calls, e.g. downloading a PDF
    get: path => request('GET', path),
    post: (path, body) => request('POST', path, body ?? {}),
    put: (path, body) => request('PUT', path, body ?? {}),
    delete: path => request('DELETE', path)
  }
}

// Signs in with a fixture account, e.g. login(baseUrl, 'chair7').
const login = async (baseUrl, accountKey) => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `${accountKey}@school.test`, password: TEST_PASSWORD })
  })
  if (response.status !== 200) throw new Error(`Login as ${accountKey} failed with ${response.status}: ${await response.text()}`)
  const cookie = response.headers.get('set-cookie').split(';')[0]
  return makeClient(baseUrl, cookie)
}

module.exports = { startServer, makeClient, login }
