import { EventEmitter } from 'node:events'

export class BaseEndpoint extends EventEmitter {
    close() {
        return this.connection.close()
    }
    connect() {
        return this.connection.connect()
    }
}