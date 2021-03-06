const EventEmitter2 = require('eventemitter2')
const IlpPacket = require('ilp-packet')
const http = require('http')
const fetch = require('node-fetch')
const logPlugin = require('debug')('ilp-plugin-http')
const logServerRequest = require('debug')('Server Request')
const logClientRequest = require('debug')('Client-Request')
const logClientResponse = require('debug')('Client-Response')
const logServerResponse = require('debug')('Server.Response')

class Plugin extends EventEmitter2 {
  constructor (opts) {
    super()
    this.opts = opts
  }

  async connect () {
    if (this.opts.port) {
      await new Promise(resolve => {
        this.server = createServer(this.handle.bind(this))
        this.server.listen(this.opts.port, () => {
          logPlugin('listening for http on port ' + this.opts.port)
          resolve()
        })
      })
    }
    this._connected = true
    this.emit('connect')
  }
  disconnect () {
    return new Promise(resolve => this.server.close(() => {
      this._connected = false
      this.emit('disconnect')
      resolve()
    }))
  }
  isConnected () { return this._connected }

  handle(req, res) {
    let chunks = []
    req.on('data', (chunk) => { chunks.push(chunk) })
    req.on('end', () => {
      logServerRequest(req.headers, Buffer.concat(chunks))
      // Convert from ilp-packet object field names described in:
      // https://github.com/interledger/rfcs/blob/de237e8b9250d83d5e9d9dec58e7aca88c887b57/0000-ilp-over-http.md#request
      // to the http header names described in:
      // https://github.com/interledgerjs/ilp-packet/blob/7724aa28330d567e0afc9512ab966d11a0d19d3c/README.md#ilpprepare-ilpfulfill-ilpreject
      Promise.resolve().then(() => {
        return this._dataHandler(IlpPacket.serializeIlpPrepare({
          destination:        req.headers['ilp-destination'],
          executionCondition: Buffer.from(req.headers['ilp-condition'], 'base64'),
          expiresAt:          new Date(req.headers['ilp-expiry']),
          amount:             req.headers['ilp-amount'],
          data:               Buffer.concat(chunks)
        }))
      }).then(response => {
        const obj = IlpPacket.deserializeIlpPacket(response)
        let statusCode
        let headers
        switch (obj.type) {
          case IlpPacket.Type.TYPE_ILP_FULFILL:
            statusCode = 200
            headers = {
              'ilp-fulfillment': obj.data.fulfillment.toString('base64'),
            }
            break
          case IlpPacket.Type.TYPE_ILP_REJECT:
            statusCode = 400
            headers = {
              'ilp-error-Code': obj.data.code,
              'ilp-error-Name': obj.data.message, // what is called message in ILP Reject is called Name in ilp-over-http-head
              'ilp-error-Triggered-By': obj.data.triggeredBy,
              'ilp-error-Triggered-At': new Date().toISOString(), // trigggered-at doesn't exist in ILP Reject
              'ilp-error-Forwarded-By': '', // forwarded-by doesn't exist in ILP Reject
            }
            break
          default:
            throw new Error('unexpected response type ' + obj.type)
        }
        logServerResponse(statusCode, headers, obj.data.data)
        res.writeHead(statusCode, headers)
        res.end(obj.data.data)
      }).catch(err => {
        logServerResponse(500, err)
        res.writeHead(500)
        res.end(err.message) // only for debugging, you probably want to disable this line in production
      })
    })
  }

  sendData (packet) {
    const obj = IlpPacket.deserializeIlpPrepare(packet)
    const headers = {
      'ilp-destination':  obj.destination,
      'ilp-condition':    obj.executionCondition.toString('base64'),
      'ilp-expiry':       obj.expiresAt.toISOString(),
      'ilp-amount':       obj.amount,
    }
    logClientRequest(headers, obj.data)
    return fetch(this.opts.peerUrl, {
      method: 'POST',
      headers,
      body: obj.data
    }).then(res => {
      return res.buffer().then(body => {
        logClientResponse(res.status, res.headers.raw(), body)
        if (res.status === 200) {
          return IlpPacket.serializeIlpFulfill({
            fulfillment: Buffer.from(res.headers.get('ilp-fulfillment'), 'base64'),
            data: body
          })
        } else {
          return IlpPacket.serializeIlpReject({
            code:          res.headers.get('ilp-error-code'),
            message:       res.headers.get('ilp-error-name'), // name header is for ILP Reject Message field
            triggeredBy:   res.headers.get('ilp-error-triggered-by'),
            // ignore forwarded-by and triggered-at
            data: body
          })
        }
      })
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
  sendMoney (amount) { return Promise.resolve() }
  registerMoneyHandler (handler) { this._moneyHandler = handler }
  deregisterMoneyHandler (handler) { delete this._moneyHandler }
}
Plugin.version = 2
module.exports = Plugin
