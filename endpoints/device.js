import { EventEmitter } from 'node:events'
import { RESTConnector } from '../connections/index.js'

export class DeviceEndpoint extends EventEmitter {
    constructor(...args) {
        super()
        this.connection = new RESTConnector(...args)
    }
    getDeviceInfo() {
        return this.connection.get()
    }
    async isOn() {
        const { device: { PowerState: powerState } } = await this.getDeviceInfo()
        return powerState === 'on'
    }
}