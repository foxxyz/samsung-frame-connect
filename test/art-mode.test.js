import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:https'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { WebSocketServer } from 'ws'
import { ArtModeEndpoint } from '../endpoints/index.js'

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
        this.nextResponses = []
        this.client = null
    }
    addClient(ws, req) {
        const path = req.url
        if (path !== '/api/v2/channels/com.samsung.art-app?name=dW5kZWZpbmVkQXJ0&token=None') return ws.close()
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
    queueResponse(response) {
        this.nextResponses.push(response)
    }
    receive(data) {
        const { method, params } = JSON.parse(data.toString('utf8'))
        if (method !== 'ms.channel.emit') return
        const { event, to, data: nestedData } = params
        if (to !== 'host' || event !== 'art_app_request') return
        // eslint-disable-next-line camelcase
        const { request_id } = JSON.parse(nestedData)

        for (const response of this.nextResponses) {
            // eslint-disable-next-line camelcase
            response.request_id = request_id

            this.client.send(JSON.stringify({
                event: 'd2d_service_message',
                data: JSON.stringify(response)
            }))
        }
    }
}

let mockTV, endpoint
describe('Art Mode Commands', () => {
    beforeEach(async() => {
        mockTV = new MockTV()
        await mockTV.listen()
        endpoint = new ArtModeEndpoint({
            host: '127.0.0.1',
            port: 8003,
            verbosity: 0
        })
        await endpoint.connect()
    })
    afterEach(async() => {
        await endpoint.close()
        await mockTV.close()
    })
    it('can return a list of available art pieces', async() => {
        mockTV.queueResponse({
            event: 'get_content_list',
            content_list: JSON.stringify([
                {
                    content_id: 'MY_F0016',
                    category_id: 'MY-C0002',
                    slideshow: 'false',
                    matte_id: 'modern_warm',
                    portrait_matte_id: 'modern_polar',
                    width: 1920,
                    height: 1080,
                    image_date: '2024:07:11 04:08:44',
                    content_type: 'mobile'
                },
                {
                    content_id: 'MY_F0012',
                    category_id: 'MY-C0002',
                    slideshow: 'false',
                    matte_id: 'squares_polar',
                    portrait_matte_id: 'none',
                    width: 1920,
                    height: 1080,
                    image_date: '2024:07:08 00:11:51',
                    content_type: 'mobile'
                }
            ])
        })
        const pieces = await endpoint.getAvailableArt()
        assert.deepEqual(pieces, [
            {
                id: 'MY_F0016',
                date: new Date('2024-07-11 04:08:44'),
                categoryId: 'MY-C0002',
                slideshow: false,
                matte: { type: 'modern', color: 'warm' },
                portraitMatte: { type: 'modern', color: 'polar' },
                width: 1920,
                height: 1080,
            },
            {
                id: 'MY_F0012',
                date: new Date('2024-07-08 00:11:51'),
                categoryId: 'MY-C0002',
                slideshow: false,
                matte: { type: 'squares', color: 'polar' },
                portraitMatte: null,
                width: 1920,
                height: 1080,
            }
        ])
        await endpoint.close()
    })
    it('can return a list of matte types', async() => {
        mockTV.queueResponse({
            event: 'get_matte_list',
            matte_type_list: '[\n  {\n    "matte_type": "none"\n  },\n  {\n    "matte_type": "modernthin"\n  },\n  {\n    "matte_type": "modern"\n  },\n  {\n    "matte_type": "modernwide"\n  },\n  {\n    "matte_type": "flexible"\n  },\n  {\n    "matte_type": "shadowbox"\n  },\n  {\n    "matte_type": "panoramic"\n  },\n  {\n    "matte_type": "triptych"\n  },\n  {\n    "matte_type": "mix"\n  },\n  {\n    "matte_type": "squares"\n  }\n]',
            matte_color_list: '[\n  {\n    "color": "black",\n    "R": 34,\n    "G": 34,\n    "B": 33\n  },\n  {\n    "color": "neutral",\n    "R": 137,\n    "G": 136,\n    "B": 134\n  },\n  {\n    "color": "antique",\n    "R": 224,\n    "G": 219,\n    "B": 210\n  },\n  {\n    "color": "warm",\n    "R": 231,\n    "G": 231,\n    "B": 223\n  },\n  {\n    "color": "polar",\n    "R": 232,\n    "G": 230,\n    "B": 231\n  },\n  {\n    "color": "sand",\n    "R": 164,\n    "G": 145,\n    "B": 113\n  },\n  {\n    "color": "seafoam",\n    "R": 90,\n    "G": 104,\n    "B": 101\n  },\n  {\n    "color": "sage",\n    "R": 170,\n    "G": 176,\n    "B": 141\n  },\n  {\n    "color": "burgandy",\n    "R": 98,\n    "G": 39,\n    "B": 46\n  },\n  {\n    "color": "navy",\n    "R": 39,\n    "G": 53,\n    "B": 74\n  },\n  {\n    "color": "apricot",\n    "R": 239,\n    "G": 188,\n    "B": 96\n  },\n  {\n    "color": "byzantine",\n    "R": 136,\n    "G": 86,\n    "B": 137\n  },\n  {\n    "color": "lavender",\n    "R": 182,\n    "G": 171,\n    "B": 177\n  },\n  {\n    "color": "redorange",\n    "R": 219,\n    "G": 103,\n    "B": 66\n  },\n  {\n    "color": "skyblue",\n    "R": 105,\n    "G": 192,\n    "B": 211\n  },\n  {\n    "color": "turquoise",\n    "R": 46,\n    "G": 150,\n    "B": 141\n  }\n]'
        })

        const types = await endpoint.getMatteTypes()
        assert.deepEqual(types, ['none', 'modernthin', 'modern', 'modernwide', 'flexible', 'shadowbox', 'panoramic', 'triptych', 'mix', 'squares'])
        await endpoint.close()
    })
    it('can return a list of matte colors', async() => {
        mockTV.queueResponse({
            event: 'get_matte_list',
            matte_type_list: '[\n  {\n    "matte_type": "none"\n  },\n  {\n    "matte_type": "modernthin"\n  },\n  {\n    "matte_type": "modern"\n  },\n  {\n    "matte_type": "modernwide"\n  },\n  {\n    "matte_type": "flexible"\n  },\n  {\n    "matte_type": "shadowbox"\n  },\n  {\n    "matte_type": "panoramic"\n  },\n  {\n    "matte_type": "triptych"\n  },\n  {\n    "matte_type": "mix"\n  },\n  {\n    "matte_type": "squares"\n  }\n]',
            matte_color_list: '[\n  {\n    "color": "black",\n    "R": 34,\n    "G": 34,\n    "B": 33\n  },\n  {\n    "color": "turquoise",\n    "R": 46,\n    "G": 150,\n    "B": 141\n  }\n]'
        })

        const colors = await endpoint.getMatteColors()
        assert.deepEqual(colors, ['black', 'turquoise'])
        await endpoint.close()
    })
    it('can delete an existing art piece', async() => {
        // it actually sends an additional event that has
        // no request_id - we don't currently use it
        // mockTV.queueResponse({
        //     event: 'image_deleted',
        //     content_id: 'MY_F0012',
        // })
        mockTV.queueResponse({
            event: 'delete_image_list',
            content_id_list: JSON.stringify([{ content_id: 'MY_F0012' }]),
        })

        await assert.doesNotReject(endpoint.deleteArt('MY_F0012'))
    })
    it('reports an error if the art to be deleted does not exist', async() => {
        mockTV.queueResponse({
            event: 'error',
            error_code: '-10',
        })
        await assert.rejects(endpoint.deleteArt('MY_F0012'), /item does not exist/i)
    })
})
