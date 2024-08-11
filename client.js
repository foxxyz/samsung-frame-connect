import { EventEmitter } from 'node:events'
import { ArtModeEndpoint, DeviceEndpoint, RemoteControlEndpoint } from './endpoints/index.js'

const SERVICES = {
    'art-mode': ArtModeEndpoint,
    device: DeviceEndpoint,
    'remote-control': RemoteControlEndpoint,
}

export class SamsungFrameClient extends EventEmitter {
    constructor({ host, name = 'SamsungTv', services = ['art-mode', 'remote-control', 'device'], verbosity = 2 }) {
        super()
        this.endpoints = services.map(s => new SERVICES[s]({ host, name, verbosity }))
        // Delegate any methods not found to any endpoint that implements it
        return new Proxy(this, {
            get(target, prop) {
                if (target[prop]) return target[prop]
                for (const connector of target.endpoints) {
                    if (!connector[prop]) continue
                    return connector[prop].bind(connector)
                }
            }
        })
    }
    close() {
        return Promise.all(this.endpoints.map(e => e.close()))
    }
    connect() {
        return Promise.all(this.endpoints.map(e => e.connect()))
    }
}
