import { EventEmitter } from 'node:events'
import { createLogger } from '../util.js'

export class RESTConnector extends EventEmitter {
    constructor({ host, name, verbosity = 2 }) {
        super()
        this.name = name
        this.log = createLogger({ name, verbosity })
        this.url = `http://${host}:8001/api/v2/`
    }
    // eslint-disable-next-line class-methods-use-this
    close() {
        // Intentionally empty, REST connection is stateless
    }
    // eslint-disable-next-line class-methods-use-this
    connect() {
        // Intentionally empty, REST connection is stateless
    }
    async get(path = '') {
        const res = await fetch(`${this.url}${path}`)
        return res.json()
    }
}