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
        return new Proxy(this, {
            get(target, prop) {
                if (target[prop]) return target[prop]
                for (const connector of Object.values(target.connections)) {
                    if (connector[prop]) return connector[prop].bind(connector)
                }
            }
        })
    }
    close() {
        return Promise.all([
            this.connections.art.close(),
            this.connections.remote.close(),
        ])
    }
    connect() {
        return Promise.all([
            this.connections.art.connect(),
            this.connections.remote.connect(),
        ])
    }
}
