// mjs to enable normal import and exports
// MDN DOCUMENTATION https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#server_handshake_response

import { createServer, request } from 'http'
import crypto from 'crypto'

const PORT = 1337

// Default socket key provided by websocket documentation
const WEBSOCKET_MAGIC_STRING_KEY = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

const SEVEN_BITS_INTEGER_MARKER = 125
const SIXTEEN_BITS_INTEGER_MARKER = 126
const SIXTYFOUR_BITS_INTEGER_MARKER = 127

const MAXIMUN_SIXTEEN_BITS_INTEGER = 2 ** 16 // 0 to 65536
const MASK_KEY_BYTES_LENGTH = 4
const OPCODE_TEXT = 0x01 // 1 bit in binary 1

// parseInt('10000000', 2)
const FIRST_BIT = 128

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

function unmask(encodedBuffer, maskKey) {

    const finalBuffer = Buffer.from(encodedBuffer)
    //  Because the maskKey has only 4 bytes
    // index % 4 === 0, 1, 2, , 3 = index bits needed to decode the message

    // XOR ^ 
    // returns 1 if both are different
    // returns 0 if both are equal

    // (71).toString(2).padStart(8, "0") = 0 1 0 0 0 1 1 1
    // (53).toString(2).padStart(8, "0") = 0 0 1 1 0 1 0 1
    //                                     0 1 1 1 0 0 1 0

    // (71 ^ 53).toString(2).padStart(9, "0") = '01110010'
    // String.fromCharCode(parseInt('01110010', 2)) => 'r'

    const fillWithEightZeros = (t) => t.padStart(8, '0')
    const toBinary = (t) => fillWithEightZeros(t.toString(2))
    const fromBinaryToDecimal = (t) => parseInt(toBinary(t), 2)
    const getCharFromBinary = (t) => String.fromCharCode(fromBinaryToDecimal(t))

    for (let index = 0; index <= encodedBuffer.length; index++) {
        finalBuffer[index] = encodedBuffer[index] ^ maskKey[index % MASK_KEY_BYTES_LENGTH]

        const logger = {
            unmaskingCalc: encodedBuffer[index]
                ? `${toBinary(encodedBuffer[index])} ^ ${toBinary(maskKey[index % MASK_KEY_BYTES_LENGTH])} = ${toBinary(finalBuffer[index])}`
                : '',
            decoded: encodedBuffer[index]
                ? getCharFromBinary(finalBuffer[index])
                : ''
        }
        console.log(logger)
    }

    return finalBuffer
}

function concat(bufferList, totalLength) {
    const target = Buffer.allocUnsafe(totalLength)
    let offset = 0
    for (const buffer of bufferList) {
        target.set(buffer, offset)
        offset += buffer.length
    }
    return target
}

function prepareMessage(message) {
    const msg = Buffer.from(message)
    const messageSize = msg.length

    let dataFrameBuffer;
    let offset = 2

    //0x80 === 128 in binary
    // '0x' + Math.abs(128).toString(16) == 0x80
    const firstByte = 0x80 | OPCODE_TEXT // Single farme + text
    if (messageSize <= SEVEN_BITS_INTEGER_MARKER) {
        const bytes = [firstByte]
        dataFrameBuffer = Buffer.from(bytes.concat(messageSize))
    } else if (messageSize <= MAXIMUN_SIXTEEN_BITS_INTEGER) {
        const offsetFourBites = 4
        const target = Buffer.allocUnsafe(offsetFourBites)
        target[0] = firstByte
        target[1] = SIXTEEN_BITS_INTEGER_MARKER | 0x0 // just to know the mask

        target.writeUint16BE(messageSize, 2) // content length is 2 bytes
        dataFrameBuffer = target

        // alloc 4 bytes
        // [0] - 128 + 1 - 100000001 = 0x81 fin + upcode
        // [1] - 126 + 0 - payload length marker + mask indicator
        // [2] 0 - content length
        // [3] 171 - content length
        // [ 4 - ..] - the message itself

    } else {
        throw new Error ('Message too long buddy :/')
    }

    const totalLength = dataFrameBuffer.byteLength + messageSize
    const dataFrameResponse = concat([dataFrameBuffer, msg], totalLength)
    return dataFrameResponse
}

function sendMessage(msg, socket) {
    const dataFrameBuffer = prepareMessage(msg)
    socket.write(dataFrameBuffer)
}

// Function to be executed when the socket is readable
function onSocketReadable(socket) {
    // Consume optcode (first byte)
    // 1 - 1 byte = 8bits
    socket.read(1)

    const [markerAndPayloadLength] = socket.read(1)
    // Because the first bit is always 1 for client-to-server messages
    // you can subtract one bit (128 or '10000000')
    // from this byte to get rid of the MASK bit
    const lengthIndicatorInBits = markerAndPayloadLength - FIRST_BIT

    let messageLength = 0

    if (lengthIndicatorInBits <= SEVEN_BITS_INTEGER_MARKER) {
        messageLength = lengthIndicatorInBits
    } else if (lengthIndicatorInBits === SIXTEEN_BITS_INTEGER_MARKER) {
        // unsigned, big-endian 16-bit integer [0 -65k] - 2 ** 16
        messageLength = socket.read(2).readUint16BE(0)
    } else {
        throw new Error('Your message is to long, we do not handle 64-bit messages')
    }
    
    const maskKey = socket.read(MASK_KEY_BYTES_LENGTH)
    const encoded = socket.read(messageLength)
    const decoded = unmask(encoded, maskKey)
    const received = decoded.toString('utf-8')
    const data  = JSON.parse(received)
    console.log('Message received => ', data)

    const msg = JSON.stringify({
        message: data,
        at: new Date().toISOString()
    })
    sendMessage(msg, socket)
}


// Handling the socket upgrade
function onSocketUpgrade(req, socket, head) {
    // Get the current client key
    const { 'sec-websocket-key': webClientSocketKey } = req.headers
    console.log(`${webClientSocketKey} connected!`)
    const headers = prepareHandShakeHeaders(webClientSocketKey)
    socket.write(headers)
    socket.on('readable', () => onSocketReadable(socket))
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
