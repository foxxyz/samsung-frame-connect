import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { TLSSocket } from 'node:tls'
import { createLogger } from '../util.js'
import { WebSocket } from 'ws'

const MAX_BRIGHTNESS = 10

// Possible event names that can be emitted:
// - art_mode_changed: Toggle art mode on/off
// - get_artmode_settings: Returning current art mode settings
// - go_to_standby: TV going to standby
// - image_selected: New image has been selected
// - recently_set_updated: Recent items list has been updated
// - set_brightness: Brightness was changed
// - wakeup
export class WSConnector extends EventEmitter {
    constructor({ host, endpoint, name, verbosity = 2 }) {
        super()
        this.connected = false
        this.name = name
        this.b64Name = btoa(this.name)
        this.log = createLogger({ name, verbosity })
        this.token = null
        this.tokenFile = join(tmpdir(), `.samsung-frame-connect-${endpoint}-token`)
        this.url = `wss://${host}:8002/api/v2/channels/${endpoint}?name=${this.b64Name}`
        this.reconnectInterval = 3
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
    async connect() {
        this.token = await this.retrieveToken()
        const url = `${this.url}&token=${this.token ? this.token : 'None'}`
        this.socket = new WebSocket(url, { rejectUnauthorized: false })
        this.socket.onerror = this.error.bind(this)
        this.socket.onmessage = this.receive.bind(this)
        this.socket.onopen = this.opened.bind(this)
        this.socket.onclose = this.closed.bind(this)
        const token = await new Promise(res => this.once('channelConnect', res))
        if (token) {
            this.close()
            await this.storeToken(token)
            return this.connect()
        } else if (!this.token) {
            // Wait for ready event
            return new Promise(res => this.once('ready', res))
        }
    }
    async getAPIVersion() {
        const { version } = await this.request({ action: 'api_version' })
        return version
    }
    getArtModeInfo() {
        return this.request({ action: 'get_device_info' })
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
    error(e) {
        console.log(e)
        this.log.warn(`Socket connection to ${this.url} refused: ${e.toString()}`)
    }
    async inArtMode() {
        const { value } = await this.request({ action: 'get_artmode_status' })
        return value === 'on'
    }
    opened() {
        this.connected = true
        this.emit('connect', this)
        this.log.info(`Socket connected at ${this.socket.url}`)
    }
    receive({ data: rawData }) {
        const { data, event } = JSON.parse(rawData)
        this.log.debug(`Received ${event}: `, data)
        // Connect confirmation
        if (event === 'ms.channel.connect') return this.emit('channelConnect', data.token)
        // Ready to receive commands
        if (event === 'ms.channel.ready') return this.emit('ready')
        // "data" is JSON doubly-encoded
        if (event === 'd2d_service_message') {
            const { request_id: requestID, event, ...response } = JSON.parse(data)
            if (requestID) {
                return this.emit(`response/${requestID}`, response)
            }
            this.emit(event, response)
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
        this.log.debug('Sent: ', message)
        this.socket.send(JSON.stringify(message))
        return new Promise(res => this.once(`response/${id}`, res))
    }
    async retrieveToken() {
        if (this.token) return this.token
        try {
            return await readFile(this.tokenFile, { encoding: 'utf8' })
        } catch (e) {
            this.log.debug(`Token file not found or unreadable (${e.toString()}). Waiting for new`)
        }
    }
    setBrightness(value) {
        return this.request({
            action: 'set_brightness',
            value: Math.max(0, Math.min(MAX_BRIGHTNESS, Math.floor(value)))
        })
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
    storeToken(token) {
        this.token = token
        return writeFile(this.tokenFile, this.token)
    }
    async togglePower() {
        const message = {
            method: 'ms.remote.control',
            params: {
                Cmd: 'Press',
                DataOfCmd: 'KEY_POWER',
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey'
            }
        }
        this.log.debug('Sent: ', message)
        this.socket.send(JSON.stringify(message))
        await setTimeout(3000)
        const message2 = {
            method: 'ms.remote.control',
            params: {
                Cmd: 'Release',
                DataOfCmd: 'KEY_POWER',
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey'
            }
        }
        this.log.debug('Sent: ', message2)
        this.socket.send(JSON.stringify(message2))
    }
    async upload(buff, { fileType = 'png', matte = 'none' }) {
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