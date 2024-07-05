import { EventEmitter } from 'node:events'
import { WSConnector, RESTConnector } from './connections/index.js'

export class SamsungFrameClient extends EventEmitter {
    constructor({ host, name = 'SamsungTv', verbosity = 2 }) {
        super()
        this.connections = {
            art: new WSConnector({ host, name: `${name}Art`, endpoint: 'com.samsung.art-app', verbosity }),
            remote: new WSConnector({ host, name: `${name}Remote`, endpoint: 'samsung.remote.control', verbosity }),
            rest: new RESTConnector({ host, verbosity })
        }
    }
    connect() {
        return Promise.all([
            this.connections.art.connect(),
            this.connections.remote.connect(),
        ])
    }
    getAPIVersion() {
        return this.connections.art.getAPIVersion()
    }
    getArtModeInfo() {
        return this.connections.art.getArtModeInfo()
    }
    getAvailableArt() {
        return this.connections.art.getAvailableArt()
    }
    getBrightness() {
        return this.connections.art.getBrightness()
    }
    getCurrentArt() {
        return this.connections.art.getCurrentArt()
    }
    getDeviceInfo() {
        return this.connections.rest.getDeviceInfo()
    }
    inArtMode() {
        return this.connections.art.inArtMode()
    }
    isOn() {
        return this.connections.rest.isOn()
    }
    setBrightness(value) {
        return this.connections.art.setBrightness(value)
    }
    setCurrentArt({ id, category }) {
        return this.connections.art.setCurrentArt({ id, category })
    }
    togglePower() {
        return this.connections.remote.togglePower()
    }
    upload(buff, options) {
        return this.connections.art.upload(buff, options)
    }
}