const EventEmitter2 = require('eventemitter2')
const IlpPacket = require('ilp-packet')
const http = require('http')


// Convert in the opposite direction
function oerToHttp(data) {
  const packet = IlpPacket.deserializeIlpPacket(data)
  return {
    headers: {
      'ILP-Destination':  packet.data.destination,
      'ILP-Condition':    packet.data.executionCondition.toString('base64'),
      'ILP-Expiry':       packet.data.expiresAt.toISOString(),
      'ILP-Amount':       packet.data.amount,
      'ILP-Fulfillment':  packet.data.fulfillment
    },
    body:                 packet.data.data
  }
}

class Plugin extends EventEmitter2 {
  constructor (opts) {
    super()
    this.opts = opts
  }


  connect () {
    this.server = http.createServer((req, res) => {
      let chunks = []
      res.on('data', (chunk) => {
      	chunks.push(chunk)
      })
      res.on('end', () => {
        // Convert from ilp-packet object field names described in:
        // https://github.com/interledger/rfcs/blob/de237e8b9250d83d5e9d9dec58e7aca88c887b57/0000-ilp-over-http.md#request
        // to the http header names described in:
        // https://github.com/interledgerjs/ilp-packet/blob/7724aa28330d567e0afc9512ab966d11a0d19d3c/README.md#ilpprepare-ilpfulfill-ilpreject
        Promise.resolve().then(() => {
          return this._dataHandler(IlpPacket.serializeIlpPrepare({
            destination:        req.headers['ILP-Destination'],
            executionCondition: Buffer.from(req.headers['ILP-Condition'], 'base64'),
            expiresAt:          new Date(req.headers['ILP-Expiry']),
            amount:             req.headers['ILP-Amount'],
            fulfillment:        req.headers['ILP-Fulfillment'],
            data:               Buffer.concat(chunks))
          })
        }).then(response => {
          const obj = IlpPacket.deserializeIlpPacket(response)
          switch (obj.type) {
            case 13:
              res.writeHead(200, {
                'ILP-Fulfillment': obj.data.fulfillment,
              })
              res.end(obj.data.data)
              break
            case 14:
              res.writeHead(400, {
                'ILP-Error-Code': obj.data.code,
                'ILP-Error-Name': obj.data.name,
                'ILP-Error-Triggered-By': obj.data.triggeredBy,
                'ILP-Error-Triggered-At': new Date().toISOString(),
                'ILP-Error-Message': obj.data.message,
              })
              res.end(obj.data.data)
              break
            default:
              throw new Error('unexpected response type ' + obj.type)
          }
        }).catch(err => {
          console.error(err)
          res.writeHead(500)
          res.end(err.message) // only for debugging, you probably want to disable this line in production
        })
      })
    })
    return new Promise(resolve => {
      this.listen(this.opts.port, () => {
        this._connected = true
        this.emit('connect')
        resolve()
      })
    })
  }
  disconnect () {
    return new Promise(resolve => this.server.close(() => {
      this._connected = false
      this.emit('disconnect')
      resolve()
    })
  }
  isConnected () { return this._connected }

  sendData (data) {
    const obj = oerToHttp(data)
    return fetch(this.opts.peerUrl, {
      method: 'POST',
      body:Promise.resolve(this.mirror._dataHandler ? this.mirror._dataHandler(data) : null) }
  registerDataHandler (handler) { this._dataHandler = handler }
  deregisterDataHandler (handler) { delete this._dataHandler }
}
Plugin.version = 2
module.exports = Plugin
