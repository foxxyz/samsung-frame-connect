import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { Agent, MockAgent, setGlobalDispatcher } from 'undici'

import { RESTConnector } from '../connections/rest.js'

const mockAgent = new MockAgent()
before(() => {
    setGlobalDispatcher(mockAgent)
    mockAgent.disableNetConnect()
})

after(async() => {
    await mockAgent.close()
    setGlobalDispatcher(new Agent())
})

const SAMPLE_GET_RESPONSE = {
    testing: {
        test: true
    }
}

describe('REST Connections', () => {
    let connector
    beforeEach(() => {
        connector = new RESTConnector({ host: '127.0.0.1', verbosity: 0 })
    })
    it('can make GET requests', async() => {
        const pool = mockAgent.get('http://127.0.0.1:8001')

        pool.intercept({ path: '/api/v2/' })
            .reply(200, JSON.stringify(SAMPLE_GET_RESPONSE))

        const response = await connector.get()
        assert.deepEqual(response, { testing: { test: true } })
    })
})
