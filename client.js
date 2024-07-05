import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { TLSSocket } from 'node:tls'
import { createLogger } from './util.js'
import { WebSocket } from 'ws'

export class SamsungFrameClient extends EventEmitter {
    constructor({ host, port, name = 'SamsungTvRemote', verbosity = 2 }) {
        super()
        this.connected = false
        this.name = name
        this.b64Name = btoa(this.name)
        this.log = createLogger({ verbosity })
        this.url = `wss://${host}:${port}/api/v2/channels/com.samsung.art-app?name=${this.b64Name}&token=None`
    }
    close() {
        // Close with correct disconnection code
        this.socket.close(1000)
        // Stop trying to reconnect if manually closed
        clearTimeout(this._reconnectTimer)
    }
    closed(e) {
        this.connected = false
        this.emit('close')
        // Regular closure, do not reconnect
        if (e.code === 1000) return
        // Otherwise, reconnect
        this.log.warn(`Socket closed. Retrying in ${this.reconnectInterval} seconds...`)
        // Clear any existing reconnect timers
        clearTimeout(this._reconnectTimer)
        this._reconnectTimer = setTimeout(this.connect.bind(this), this.reconnectInterval * 1000)
    }
    connect() {
        this.socket = new WebSocket(this.url, { rejectUnauthorized: false })
        this.socket.onerror = this.error.bind(this)
        this.socket.onmessage = this.receive.bind(this)
        this.socket.onopen = this.opened.bind(this)
        this.socket.onclose = this.closed.bind(this)
        // Wait for ready event
        return new Promise(res => this.once('ready', res))
    }
    async inArtMode() {
        const { value } = await this.request({ action: 'get_artmode_status' })
        return value === 'on'
    }
    async getAPIVersion() {
        const { version } = await this.request({ action: 'api_version' })
        return version
    }
    async getAvailableArt() {
        const { content_list: contentList } = await this.request({ action: 'get_content_list', category_id: 'MY-C0002' })
        return JSON.parse(contentList)
    }
    async getBrightness() {
        const { data } = await this.request({ action: 'get_artmode_settings' })
        const setting = JSON.parse(data).find(({ item }) => item === 'brightness')
        return parseInt(setting.value)
    }
    getCurrentArt() {
        return this.request({ action: 'get_current_artwork' })
    }
    getDeviceInfo() {
        return this.request({ action: 'get_device_info' })
    }
    error(e) {
        this.log.warn(`Socket connection to ${this.url} refused: ${e}`)
    }
    opened() {
        this.connected = true
        this.emit('connect', this)
        this.log.info(`Socket connected at ${this.socket.url}`)
    }
    receive({ data: rawData }) {
        const { data, event } = JSON.parse(rawData)
        // Ready to receive commands
        if (event === 'ms.channel.ready') return this.emit('ready')
        // "data" is JSON doubly-encoded
        if (event === 'd2d_service_message') {
            const { request_id: requestID, ...response } = JSON.parse(data)
            if (requestID) {
                return this.emit(`response/${requestID}`, response)
            }
        }
    }
    request({ id, action, ...params }) {
        id = id || randomUUID()
        const message = {
            method: 'ms.channel.emit',
            params: {
                event: 'art_app_request',
                to: 'host',
                data: JSON.stringify({
                    // eslint-disable-next-line
                    request_id: id,
                    request: action,
                    ...params
                }),
            }
        }
        this.socket.send(JSON.stringify(message))
        return new Promise(res => this.once(`response/${id}`, res))
    }
    setCurrentArt({ id, category }) {
        return this.request({
            action: 'select_image',
            show: true,
            // eslint-disable-next-line
            content_id: id,
            category,
        })
    }
    async upload(buff, { fileType = 'png', matte = 'modernthin_black' }) {
        const date = new Date().toISOString().slice(0, 19).replace('T', ' ').replaceAll('-', ':')
        const id = randomUUID()
        // Request an open port to send the image via
        const { conn_info: connectionInfo } = await this.request({
            action: 'send_image',
            // eslint-disable-next-line camelcase
            file_type: fileType,
            id,
            // eslint-disable-next-line camelcase
            conn_info: {
                // eslint-disable-next-line camelcase
                d2d_mode: 'socket',
                // eslint-disable-next-line camelcase
                connection_id: Math.floor(Math.random() * 4 * 1024 ** 3),
                id,
            },
            // eslint-disable-next-line camelcase
            image_date: date,
            // eslint-disable-next-line camelcase
            matte_id: matte,
            // eslint-disable-next-line camelcase
            portrait_matte_id: matte,
            // eslint-disable-next-line camelcase
            file_size: buff.length
        })

        const { ip: host, port, key: secKey } = JSON.parse(connectionInfo)
        const header = {
            num: 0,
            total: 1,
            fileLength: buff.length,
            fileName: 'test',
            fileType,
            secKey,
            version: '0.0.1',
        }

        const socket = new TLSSocket()
        await new Promise(res => {
            socket.connect({ host, port, rejectUnauthorized: false }, res)
        })
        const headerMessage = Buffer.from(JSON.stringify(header), 'ascii')
        const headerSize = Buffer.alloc(4)
        headerSize.writeUInt32BE(headerMessage.length)
        await new Promise(res => socket.write(headerSize, res))
        await new Promise(res => socket.write(headerMessage, res))
        await new Promise(res => socket.write(buff, res))
        await new Promise(res => socket.end(res))

        // Wait for confirmation
        const { content_id: contentID } = await new Promise(res => this.once(`response/${id}`, res))
        return contentID
    }
}