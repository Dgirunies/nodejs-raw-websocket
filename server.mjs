import { createServer } from 'http'
const PORT = 1337

createServer((request, response) => {
    response.writeHead(200)
    response.end("Server is alive")
})
.listen(PORT, () => console.log("Server listening to", PORT))
