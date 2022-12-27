// mjs to enable normal import and exports
// MDN DOCUMENTATION https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#server_handshake_response

import { createServer, request } from 'http'
import crypto from 'crypto'

const PORT = 1337

// Default socket key provided by websocket documentation
const WEBSOCKET_MAGIC_STRING_KEY = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

const server = createServer((request, response) => {
    response.writeHead(200)
    response.end("Server is alive")
})
.listen(PORT, () => console.log("Server listening to", PORT))

function createSocketAccept(id) {
    // Getting the sha1 algorithim as requested on the documentation
    const shaum = crypto.createHash('sha1')
    shaum.update(id + WEBSOCKET_MAGIC_STRING_KEY)
    // Returns the crypt key as a base 64
    return shaum.digest('base64')
}

function prepareHandShakeHeaders(id) {
    const acceptKey = createSocketAccept(id)
    // Requested headers from the documentation, the last line must always be empty
    const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        ''
    ].map(line => line.concat('\r\n')).join('')
    return headers
}

// Handling the socket upgrade
function onSocketUpgrade(req, socket, head) {
    // Get the current client key
    const { 'sec-websocket-key': webClientSocketKey } = req.headers
    console.log(`${webClientSocketKey} connected!`)
    const headers = prepareHandShakeHeaders(webClientSocketKey)
    socket.write(headers)
}

// When server request a connection upgrade as it is configured to list to a socket on the front end
server.on('upgrade', onSocketUpgrade)

// error handling to keep the server on
;
[
    'uncaughtException',
    'unhandledRejection'
].forEach(event =>
    process.on(event, (err) => {
        console.error(`Something gone wrong: ${event}, msg: ${err.stack || err}`)
    }))
