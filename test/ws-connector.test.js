import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:https'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { WebSocketServer } from 'ws'
import { WSConnector } from '../connections/ws.js'

const __dirname = import.meta.dirname
const TEST_CERT = {
    cert: await readFile(join(__dirname, 'cert', 'cert.pem')),
    key: await readFile(join(__dirname, 'cert', 'key.pem')),
}

class MockTV {
    constructor() {
        this.server = createServer(TEST_CERT)
        this.wss = new WebSocketServer({ server: this.server })
        this.wss.on('connection', this.addClient.bind(this))
    }
    addClient(ws, req) {
        const path = req.url
        if (path !== '/api/v2/channels/testing?name=dW5kZWZpbmVk&token=None') return ws.close()
        const connectionMessage = {
            event: 'ms.channel.connect',
            data: {
                clients: [{
                    id: '2837ec-1581-44f9-9cdf-c54229b444ad',
                    attributes: {},
                    connectTime: 1720153883972,
                    deviceName: 'BBaaa3VuZ1R2QXJ7',
                    isHost: false
                }]
            }
        }
        ws.send(JSON.stringify(connectionMessage))
        const readyMessage = {
            event: 'ms.channel.ready',
            data: {}
        }
        ws.send(JSON.stringify(readyMessage))
    }
    async close() {
        await new Promise(res => this.server.close(res))
        await new Promise(res => this.wss.close(res))
    }
    listen() {
        return new Promise(res => this.server.listen(8002, res))
    }
}

let mockTV
describe('Websocket Connections', () => {
    beforeEach(async() => {
        mockTV = new MockTV()
        await mockTV.listen()
    })
    afterEach(async() => {
        await mockTV.close()
    })
    it('can connect to an endpoint without a token', async() => {
        const connector = new WSConnector({
            host: '127.0.0.1',
            endpoint: 'testing',
            verbosity: 0
        })
        await connector.connect()
        assert.equal(connector.connected, true)
        connector.close()
    })
})
