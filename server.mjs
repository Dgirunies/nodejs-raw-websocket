import { createServer } from 'http'
const PORT = 1337

createServer((request, response) => {
    response.writeHead(200)
    response.end("Server is alive")
})
.listen(PORT, () => console.log("Server listening to", PORT))

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
