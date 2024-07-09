import { EventEmitter } from 'node:events'
import { ArtModeEndpoint, DeviceEndpoint, RemoteControlEndpoint } from './endpoints/index.js'

export class SamsungFrameClient extends EventEmitter {
    constructor({ host, name = 'SamsungTv', verbosity = 2 }) {
        super()
        this.endpoints = [
            new ArtModeEndpoint({ host, name, verbosity }),
            new RemoteControlEndpoint({ host, name, verbosity }),
            new DeviceEndpoint({ host, verbosity }),
        ]
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
        return Promise.all(this.endpoints.slice(0, 2).map(e => e.close()))
    }
    connect() {
        return Promise.all(this.endpoints.slice(0, 2).map(e => e.connect()))
    }
}
