import { RESTConnector } from '../connections/index.js'
import { BaseEndpoint } from './base.js'

export class DeviceEndpoint extends BaseEndpoint {
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