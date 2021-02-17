const path = require('path')
const EventEmitter = require('events')

const CONTROLLERS = {}

let _RED

const CONTROLLER_EVENTS = [
  'inclusion started',
  'inclusion failed',
  'inclusion stopped',
  'exclusion started',
  'exclusion failed',
  'exclusion stopped',
  'node added',
  'node removed',
  'heal network progress',
  'heal network done'
]

module.exports = {
  init: RED => {
    _RED = RED

    RED.httpAdmin.get('/zwave-js/client.js', function (req, res) {
      res.sendFile(path.join(__dirname, 'client.js'))
    })
    RED.httpAdmin.get('/zwave-js/styles.css', function (req, res) {
      res.sendFile(path.join(__dirname, 'styles.css'), { contentType: 'text/css' })
    })

    RED.httpAdmin.get('/zwave-js/list', (req, res) => {
      res.send(Object.keys(CONTROLLERS))
    })

    RED.httpAdmin.post('/zwave-js/:homeId', (req, res) => {
      // Handles requests from the client for Controller and Node functions.
      // Passes request to main module.
      // Requests must be structued the same as the payload that would
      //   normally be sent into the Node-RED node.
      // Response is then passed back to client.

      let Controller = CONTROLLERS[req.params.homeId]

      if (!Controller) return res.status(404).end()

      Controller.request(
        { payload: req.body },
        zwaveRes => res.send(zwaveRes.payload),
        err => err && res.status(500).send(err.message)
      )
    })
  },
  register: (driver, request) => {
    driver.on('driver ready', () => {
      // Creates listeners for all events on Controller and all Nodes.
      // Passes events to client via comms.publish().
      // Some events are published for the controller (even if node-related).
      // Other events are published for a specific node which
      //   will only go to clients that have that node selected.

      let { controller } = driver

      let homeId = controller.homeId.toString(16)

      CONTROLLERS[homeId] = { controller, request }

      CONTROLLER_EVENTS.forEach(event => {
        controller.on(event, (...args) => {
          _RED.comms.publish(`/zwave-js/${homeId}`, {
            type: 'controller-event',
            event,
            args
          })
        })
      })

      let emitNodeStatus = status => node =>
        _RED.comms.publish(`/zwave-js/${homeId}`, {
          type: 'node-status',
          node: node.id,
          status
        })
      let emitNodeAsleep = emitNodeStatus(1)
      let emitNodeAwake = emitNodeStatus(2)
      let emitNodeDead = emitNodeStatus(3)
      let emitNodeAlive = emitNodeStatus(4)

      let emitNodeEvent = type => (node, payload) =>
        _RED.comms.publish(`/zwave-js/${homeId}/${node.id}`, {
          type,
          payload
        })
      let emitNodeInterview = emitNodeEvent('node-interview')
      let emitNodeValue = emitNodeEvent('node-value')
      let emitNodeMeta = emitNodeEvent('node-meta')

      controller.nodes.forEach(node => {
        // Status
        node.on('sleep', emitNodeAsleep)
        node.on('wake up', emitNodeAwake)
        node.on('dead', emitNodeDead)
        node.on('alive', emitNodeAlive)

        // Readiness/Interview Stage
        node.on('ready', node => {
          emitNodeStatus('ready')(node)
          emitNodeInterview(node)
        })
        node.on('interview completed', emitNodeInterview)
        node.on('interview failed', emitNodeInterview)

        // Values
        node.on('value added', emitNodeValue)
        node.on('value updated', emitNodeValue)
        node.on('value removed', emitNodeValue)
        node.on('value notification', emitNodeValue)

        // Meta
        node.on('metadata update', emitNodeMeta)
      })
    })
  },
  unregister: homeId => {
    delete CONTROLLERS[homeId]
    // Driver (and listeners) will be destroyed by main module, so nothing else to do here
  }
}
