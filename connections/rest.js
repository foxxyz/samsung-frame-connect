import { EventEmitter } from 'node:events'
import { createLogger } from '../util.js'

export class RESTConnector extends EventEmitter {
    constructor({ host, name = 'SamsungTvRemote', verbosity = 2 }) {
        super()
        this.name = name
        this.log = createLogger({ name, verbosity })
        this.url = `http://${host}:8001/api/v2/`
    }
    async getDeviceInfo() {
        const res = await fetch(this.url)
        return res.json()
    }
    async isOn() {
        const { device: { PowerState: powerState } } = await this.getDeviceInfo()
        return powerState === 'on'
    }
}