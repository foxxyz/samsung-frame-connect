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

const SAMPLE_DEVICE_INFO = {
    device: {
        EdgeBlendingSupport: 'false',
        EdgeBlendingSupportGroup: '0',
        FrameTVSupport: 'true',
        GamePadSupport: 'true',
        ImeSyncedSupport: 'true',
        Language: 'en_US',
        OS: 'Tizen',
        PowerState: 'on',
        TokenAuthSupport: 'true',
        VoiceSupport: 'true',
        WallScreenRatio: '-1',
        WallService: 'false',
        countryCode: 'US',
        description: 'Samsung DTV RCR',
        developerIP: '0.0.0.0',
        developerMode: '0',
        duid: 'uuid:ffffffff-ffff-ffff-ffff-ffffffffffff',
        firmwareVersion: 'Unknown',
        id: 'uuid:ffffffff-ffff-ffff-ffff-ffffffffffff',
        ip: '127.0.0.1',
        model: '23_KANTSU2E_FTV',
        modelName: 'QN32LS03CBFXZA',
        name: 'TestDevice',
        networkType: 'wireless',
        resolution: '1920x1080',
        smartHubAgreement: 'true',
        ssid: '88:77:66:55:44:33',
        type: 'Samsung SmartTV',
        udn: 'uuid:ffffffff-ffff-ffff-ffff-ffffffffffff',
        wifiMac: 'F0:0F:F0:0F:AA:BB'
    },
    id: 'uuid:ffffffff-ffff-ffff-ffff-ffffffffffff',
    isSupport: '{"DMP_DRM_PLAYREADY":"false","DMP_DRM_WIDEVINE":"false","DMP_available":"true","EDEN_available":"true","FrameTVSupport":"true","ImeSyncedSupport":"true","TokenAuthSupport":"true","remote_available":"true","remote_fourDirections":"true","remote_touchPad":"true","remote_voiceControl":"true"}\n',
    name: 'TestDevice',
    remote: '1.0',
    type: 'Samsung SmartTV',
    uri: 'http://127.0.0.1:8001/api/v2/',
    version: '2.0.25'
}

describe('REST Connections', () => {
    let connector
    beforeEach(() => {
        connector = new RESTConnector({ host: '127.0.0.1', verbosity: 0 })
    })
    it('can check device info', async() => {
        const pool = mockAgent.get('http://127.0.0.1:8001')

        pool.intercept({ path: '/api/v2/' })
            .reply(200, JSON.stringify(SAMPLE_DEVICE_INFO))

        const info = await connector.getDeviceInfo()
        assert.equal(info.version, '2.0.25')
        assert.equal(info.device.modelName, 'QN32LS03CBFXZA')
    })
    it('can check power status', async() => {
        const pool = mockAgent.get('http://127.0.0.1:8001')

        pool.intercept({ path: '/api/v2/' })
            .reply(200, JSON.stringify(SAMPLE_DEVICE_INFO))

        assert.equal(await connector.isOn(), true)
    })
})
