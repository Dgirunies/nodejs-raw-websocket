import { createServer } from 'http'
const PORT = 1337

const server = createServer((request, response) => {
    response.writeHead(200)
    response.end("Server is alive")
})
.listen(PORT, () => console.log("Server listening to", PORT))

server.on('upgrade', (req, socket, head) => {
    console.log(
        req,
        socket,
        head
    )
})

// error handling to keep the server on
;
[
    'uncaughtException',
    'unhandledRejection'
].forEach(event =>
    process.on(event, (err) => {
        console.error(`Something gone wrong: ${event}, msg: ${err.stack || err}`)
    }))

process.on("uncaughtException")
