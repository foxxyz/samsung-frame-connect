import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { TLSSocket } from 'node:tls'

import { WSConnector } from '../connections/ws.js'

const MAX_BRIGHTNESS = 10

// Possible event names that can be emitted:
// - art_mode_changed: Toggle art mode on/off
// - get_artmode_settings: Returning current art mode settings
// - go_to_standby: TV going to standby
// - image_selected: New image has been selected
// - recently_set_updated: Recent items list has been updated
// - set_brightness: Brightness was changed
// - wakeup
export class ArtModeEndpoint extends EventEmitter {
    constructor(args) {
        super()
        this.connection = new WSConnector({
            port: 8002,
            ...args,
            name: `${args.name}Art`,
            endpoint: 'com.samsung.art-app',
        })
    }
    close() {
        return this.connection.close()
    }
    connect() {
        return this.connection.connect()
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
    async getMatteColors() {
        const { matte_color_list: colors } = await this.request({ action: 'get_matte_list' })
        return JSON.parse(colors).map(c => c.color)
    }
    async getMatteTypes() {
        const { matte_type_list: types } = await this.request({ action: 'get_matte_list' })
        return JSON.parse(types).map(t => t.matte_type)
    }
    async inArtMode() {
        const { value } = await this.request({ action: 'get_artmode_status' })
        return value === 'on'
    }
    request(...args) {
        return this.connection.request(...args)
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
    async setMatte({ id, type, color }) {
        await this.request({
            action: 'change_matte',
            // eslint-disable-next-line
            content_id: id,
            // eslint-disable-next-line
            matte_id: type === 'none' ? type : `${type}_${color}`,
        })
        return this.setCurrentArt({ id })
    }
    async upload(buff, { fileType = 'png', matteType, matteColor }) {
        const date = new Date().toISOString().slice(0, 19).replace('T', ' ').replaceAll('-', ':')
        const id = randomUUID()
        // Create matte name
        const matte = matteType && matteType !== 'none' ? `${matteType}_${matteColor}` : 'none'
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
        const { content_id: contentID } = await new Promise(res => this.connection.once(`response/${id}`, res))
        return contentID
    }
}