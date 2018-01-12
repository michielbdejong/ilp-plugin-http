process.env.DEBUG = '*'

const IlpPacket = require('ilp-packet')
const Plugin = require('.')
const crypto = require('crypto')
function sha256 (preimage) { return crypto.createHash('sha256').update(preimage).digest() }
const fulfillment = crypto.randomBytes(32)
const condition = sha256(fulfillment)
console.log({ fulfillment, condition })

const alice = new Plugin({
  port: 9001,
  peerUrl: 'http://localhost:9002'
})
const bob = new Plugin({
  port: 9002,
  peerUrl: 'http://localhost:9001'
})

// ...
// Note that `.connect` here doesn't really establishes a connection,
// it just means start listening on the port. A http connection
// between the two plugins is only established once you call `.sendData`
// on one of them.
bob.connect().then(() => {
  bob.registerDataHandler(data => {
    console.log('data showed up at bob!', data)
    return IlpPacket.serializeIlpFulfill({
      fulfillment,
      data: Buffer.from('thank you')
    })
  })
  return alice.sendData(IlpPacket.serializeIlpPrepare({
    amount: '10',
    executionCondition: condition,
    destination: 'bobby',
    data: Buffer.from(['hello world']),
    expiresAt: new Date(new Date().getTime() + 10000)
  }))
}).then(response => {
  console.log('It worked!', IlpPacket.deserializeIlpPacket(response))
  bob.disconnect()
})
