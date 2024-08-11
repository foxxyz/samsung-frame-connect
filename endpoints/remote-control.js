import { WSConnector } from '../connections/ws.js'
import { BaseEndpoint } from './base.js'

export class RemoteControlEndpoint extends BaseEndpoint {
    constructor(args) {
        super()
        this.connection = new WSConnector({
            port: 8002,
            ...args,
            name: `${args.name}Remote`,
            endpoint: 'samsung.remote.control',
        })
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