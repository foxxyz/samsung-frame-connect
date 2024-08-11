#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { setTimeout } from 'node:timers/promises'

import 'fresh-console'
import { ArgumentParser, ArgumentDefaultsHelpFormatter, SUPPRESS } from 'argparse'
import packageInfo from './package.json' with { type: 'json' }

import { SamsungFrameClient } from './client.js'

// Parse arguments
// eslint-disable-next-line
const parser = new ArgumentParser({ add_help: true, description: packageInfo.description, formatter_class: ArgumentDefaultsHelpFormatter })
parser.add_argument('-v', { action: 'version', version: packageInfo.version })
parser.add_argument('--host', { help: 'TV Host or IP', required: true })
parser.add_argument('--port', { help: 'Websocket Port', default: 8002 })
parser.add_argument('--verbose', { help: 'Show log/debug messages', action: 'store_true' })
parser.add_argument('--image-path', { help: 'Path to an image to upload' })
const args = parser.parse_args()

const client = new SamsungFrameClient(args)
const { name, device } = await client.getDeviceInfo()
console.info(`Found ${name} (${device.type} ${device.modelName}). Connecting...`)
await client.connect()
console.success('Successfully connected!')

// Example to set matte
// client.setMatte({ id: 'MY_F0012', type: 'squares', color: 'polar' })

// Example to power cycle
// console.info('Power is on: ', await client.isOn())
// console.info(await client.togglePower())

// Example to check art mode status
// console.info(`In art mode: ${await client.inArtMode()}`)

// Example to get/set brightness
// console.info(`Current brightness: ${await client.getBrightness()}`)
// console.info(await client.setBrightness(7))

// Example to check API version
// console.info(`API Version: ${await client.getAPIVersion()}`)

// Example to check get/set displayed art
// console.info(await client.getAvailableArt())
// console.info(await client.getCurrentArt())
// console.info(await client.setCurrentArt({ id: 'SAM-F0203' }))

// Manually upload and set art
if (args.image_path) {
    // Read the image
    const imageBuffer = await readFile(args.image_path)
    // Upload and return the content ID
    const newImageID = await client.upload(imageBuffer, { fileType: extname(args.image_path).slice(1) })
    // Set the TV to the new art
    await client.setCurrentArt({ id: newImageID })
}
