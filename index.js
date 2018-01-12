const EventEmitter2 = require('eventemitter2')
const IlpPacket = require('ilp-packet')
const http = require('http')

class Plugin extends EventEmitter2 {
  constructor (opts) {
    super()
    this.opts = opts
  }

  connect () {
    this.server = http.createServer((req, res) => {
      let chunks = []
      res.on('data', (chunk) => { chunks.push(chunk) })
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
            data:               Buffer.concat(chunks)
          }))
        }).then(response => {
          const obj = IlpPacket.deserializeIlpPacket(response)
          switch (obj.type) {
            case IlpPacket.Type.TYPE_ILP_FULFILL:
              res.writeHead(200, {
                'ILP-Fulfillment': obj.data.fulfillment,
              })
              res.end(obj.data.data)
              break
            case IlpPacket.Type.TYPE_ILP_REJECT:
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
    }))
  }
  isConnected () { return this._connected }

  sendData (packet) {
    const obj = IlpPacket.deserializeIlpPrepare(packet)
    return fetch(this.opts.peerUrl, {
      method: 'POST',
      headers: {
        'ILP-Destination':  obj.destination,
        'ILP-Condition':    obj.executionCondition.toString('base64'),
        'ILP-Expiry':       obj.expiresAt.toISOString(),
        'ILP-Amount':       obj.amount,
      },
      body:                 obj.data
    }).then(res => {
      if (res.status === 200) {
        return IlpPacket.serializeIlpFulfill({
          fulfillment:        req.headers['ILP-Fulfillment'],
          data: res.body.buffer()
        })
      } else {
        return IlpPacket.serializeIlpReject({
          code:          req.headers['ILP-Error-Code'],
          name:          req.headers['ILP-Error-Name'],
          triggeredBy:   req.headers['ILP-Error-Triggered-By'],
          triggeredAt:   req.headers['ILP-Error-Triggered-At'],
          message:       req.headers['ILP-Error-Message'],
          data: res.body.buffer()
        })
      }
    }).catch(err => {
      return IlpPacket.serializeIlpReject({
        code:          'P00',
        name:          'plugin bug',
        triggeredBy:   'ilp-plugin-http',
        triggeredAt:   new Date(),
        message:       err.message,
        data: Buffer.from([])
      })
    })
  }

  registerDataHandler (handler) { this._dataHandler = handler }
  deregisterDataHandler (handler) { delete this._dataHandler }
}
Plugin.version = module.exports = Plugin
