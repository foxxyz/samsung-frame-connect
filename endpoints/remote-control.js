import { EventEmitter } from 'node:events'

import { WSConnector } from '../connections/ws.js'

export class RemoteControlEndpoint extends EventEmitter {
    constructor(args) {
        super()
        this.connection = new WSConnector({
            port: 8002,
            ...args,
            name: `${args.name}Remote`,
            endpoint: 'samsung.remote.control',
        })
    }
    close() {
        return this.connection.close()
    }
    connect() {
        return this.connection.connect()
    }
    async togglePower() {
        const message = {
            method: 'ms.remote.control',
            params: {
                Cmd: 'Press',
                DataOfCmd: 'KEY_POWER',
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey'
            }
        }
        this.log.debug('Sent: ', message)
        this.connection.socket.send(JSON.stringify(message))
        await setTimeout(3000)
        const message2 = {
            method: 'ms.remote.control',
            params: {
                Cmd: 'Release',
                DataOfCmd: 'KEY_POWER',
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey'
            }
        }
        this.log.debug('Sent: ', message2)
        this.connection.socket.send(JSON.stringify(message2))
    }
}