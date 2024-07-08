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
        this.nextResponse = null
        this.client = null
    }
    addClient(ws, req) {
        const path = req.url
        if (path !== '/api/v2/channels/testing?name=dW5kZWZpbmVk&token=None') return ws.close()
        this.client = ws
        this.client.on('message', this.receive.bind(this))
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
        this.client.send(JSON.stringify(connectionMessage))
        const readyMessage = {
            event: 'ms.channel.ready',
            data: {}
        }
        this.client.send(JSON.stringify(readyMessage))
    }
    async close() {
        await new Promise(res => this.server.close(res))
        await new Promise(res => this.wss.close(res))
    }
    listen() {
        return new Promise(res => this.server.listen(8003, res))
    }
    receive(data) {
        const { method, params } = JSON.parse(data.toString('utf8'))
        if (method !== 'ms.channel.emit') return
        const { event, to, data: nestedData } = params
        if (to !== 'host' || event !== 'art_app_request') return
        // eslint-disable-next-line camelcase
        const { request_id } = JSON.parse(nestedData)

        if (!this.nextResponse) return

        const response = this.nextResponse
        // eslint-disable-next-line camelcase
        response.request_id = request_id

        this.client.send(JSON.stringify({
            event: 'd2d_service_message',
            data: JSON.stringify(response)
        }))
    }
}

let mockTV, connector
describe('Art Mode Commands', () => {
    beforeEach(async() => {
        mockTV = new MockTV()
        await mockTV.listen()
        connector = new WSConnector({
            host: '127.0.0.1',
            port: 8003,
            endpoint: 'testing',
            verbosity: 0
        })
        await connector.connect()
    })
    afterEach(async() => {
        await connector.close()
        await mockTV.close()
    })
    it('can return a list of matte types', async() => {
        mockTV.nextResponse = {
            event: 'get_matte_list',
            matte_type_list: '[\n  {\n    "matte_type": "none"\n  },\n  {\n    "matte_type": "modernthin"\n  },\n  {\n    "matte_type": "modern"\n  },\n  {\n    "matte_type": "modernwide"\n  },\n  {\n    "matte_type": "flexible"\n  },\n  {\n    "matte_type": "shadowbox"\n  },\n  {\n    "matte_type": "panoramic"\n  },\n  {\n    "matte_type": "triptych"\n  },\n  {\n    "matte_type": "mix"\n  },\n  {\n    "matte_type": "squares"\n  }\n]',
            matte_color_list: '[\n  {\n    "color": "black",\n    "R": 34,\n    "G": 34,\n    "B": 33\n  },\n  {\n    "color": "neutral",\n    "R": 137,\n    "G": 136,\n    "B": 134\n  },\n  {\n    "color": "antique",\n    "R": 224,\n    "G": 219,\n    "B": 210\n  },\n  {\n    "color": "warm",\n    "R": 231,\n    "G": 231,\n    "B": 223\n  },\n  {\n    "color": "polar",\n    "R": 232,\n    "G": 230,\n    "B": 231\n  },\n  {\n    "color": "sand",\n    "R": 164,\n    "G": 145,\n    "B": 113\n  },\n  {\n    "color": "seafoam",\n    "R": 90,\n    "G": 104,\n    "B": 101\n  },\n  {\n    "color": "sage",\n    "R": 170,\n    "G": 176,\n    "B": 141\n  },\n  {\n    "color": "burgandy",\n    "R": 98,\n    "G": 39,\n    "B": 46\n  },\n  {\n    "color": "navy",\n    "R": 39,\n    "G": 53,\n    "B": 74\n  },\n  {\n    "color": "apricot",\n    "R": 239,\n    "G": 188,\n    "B": 96\n  },\n  {\n    "color": "byzantine",\n    "R": 136,\n    "G": 86,\n    "B": 137\n  },\n  {\n    "color": "lavender",\n    "R": 182,\n    "G": 171,\n    "B": 177\n  },\n  {\n    "color": "redorange",\n    "R": 219,\n    "G": 103,\n    "B": 66\n  },\n  {\n    "color": "skyblue",\n    "R": 105,\n    "G": 192,\n    "B": 211\n  },\n  {\n    "color": "turquoise",\n    "R": 46,\n    "G": 150,\n    "B": 141\n  }\n]'
        }

        const types = await connector.getMatteTypes()
        assert.deepEqual(types, ['none', 'modernthin', 'modern', 'modernwide', 'flexible', 'shadowbox', 'panoramic', 'triptych', 'mix', 'squares'])
        await connector.close()
    })
    it('can return a list of matte colors', async() => {
        mockTV.nextResponse = {
            event: 'get_matte_list',
            matte_type_list: '[\n  {\n    "matte_type": "none"\n  },\n  {\n    "matte_type": "modernthin"\n  },\n  {\n    "matte_type": "modern"\n  },\n  {\n    "matte_type": "modernwide"\n  },\n  {\n    "matte_type": "flexible"\n  },\n  {\n    "matte_type": "shadowbox"\n  },\n  {\n    "matte_type": "panoramic"\n  },\n  {\n    "matte_type": "triptych"\n  },\n  {\n    "matte_type": "mix"\n  },\n  {\n    "matte_type": "squares"\n  }\n]',
            matte_color_list: '[\n  {\n    "color": "black",\n    "R": 34,\n    "G": 34,\n    "B": 33\n  },\n  {\n    "color": "turquoise",\n    "R": 46,\n    "G": 150,\n    "B": 141\n  }\n]'
        }

        const types = await connector.getMatteColors()
        assert.deepEqual(types, ['black', 'turquoise'])
        await connector.close()
    })
})
