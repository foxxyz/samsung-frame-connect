#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { setTimeout } from 'node:timers/promises'

import 'fresh-console'
import { ArgumentParser, ArgumentDefaultsHelpFormatter, SUPPRESS } from 'argparse'
import packageInfo from './package.json' with { type: 'json' }

import { SamsungFrameClient } from './client.js'

// Parse arguments
// eslint-disable-next-line
const parser = new ArgumentParser({ add_help: true, description: packageInfo.description, formatter_class: ArgumentDefaultsHelpFormatter })
parser.add_argument('-v', { action: 'version', version: packageInfo.version })
parser.add_argument('--host', { help: 'Websocket Host', required: true })
parser.add_argument('--port', { help: 'Websocket Port', default: 8002 })
parser.add_argument('--verbose', { help: 'Show log/debug messages', action: 'store_true' })
parser.add_argument('--image-path', { help: 'Path to an image to upload' })
const args = parser.parse_args()

const client = new SamsungFrameClient(args)
await client.connect()
//console.info('Device info: ', await client.getDeviceInfo())
// console.info(`In art mode: ${await client.inArtMode()}`)
// console.info(`Current brightness: ${await client.getBrightness()}`)
//console.info(`API Version: ${await client.getAPIVersion()}`)
//console.info(await client.getAvailableArt())
// console.info(await client.getCurrentArt())
// console.info(await client.setCurrentArt({ id: 'SAM-F0203' }))

const imageBuffer = await readFile(args.image_path)
console.log(imageBuffer)
const newImageID = await client.upload(imageBuffer, { fileType: 'png' })

await client.setCurrentArt({ id: newImageID })

