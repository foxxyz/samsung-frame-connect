import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { createLogger } from '../util.js'
import { WebSocket } from 'ws'

export class WSConnector extends EventEmitter {
    constructor({ host, port = 8002, endpoint, name, verbosity = 2 }) {
        super()
        this.connected = false
        this.name = name
        this.b64Name = btoa(this.name)
        this.log = createLogger({ name, verbosity })
        this.token = null
        this.tokenFile = join(tmpdir(), `.samsung-frame-connect-${endpoint}-token`)
        this.url = `wss://${host}:${port}/api/v2/channels/${endpoint}?name=${this.b64Name}`
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
        const readyPromise = new Promise(res => this.once('ready', res))
        const token = await new Promise(res => this.once('channelConnect', res))
        if (token) {
            this.close()
            await this.storeToken(token)
            return this.connect()
        } else if (!this.token) {
            // Wait for ready event
            return readyPromise
        }
    }
    error(e) {
        this.log.warn(`Socket connection to ${this.url} refused: ${e.toString()}`)
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
        const signal = AbortSignal.timeout(4000)
        return new Promise((res, rej) => {
            this.once(`response/${id}`, res)
            signal.addEventListener('abort', rej, { once: true })
        })
    }
    async retrieveToken() {
        if (this.token) return this.token
        try {
            return await readFile(this.tokenFile, { encoding: 'utf8' })
        } catch (e) {
            this.log.debug(`Token file not found or unreadable (${e.toString()}). Waiting for new`)
        }
    }
    storeToken(token) {
        this.token = token
        return writeFile(this.tokenFile, this.token)
    }
}