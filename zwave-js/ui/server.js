const path = require('path')
const EventEmitter = require('events')

const CONTROLLERS = {}

let _RED

const CONTROLLER_EVENTS = [
  'node added',
  'node removed',
]

var LatestStatus;
const _SendStatus = () => {
  _RED.comms.publish(`/zwave-js/status`, {
    type: 'driver-status-update',
    message: LatestStatus
  })
}

module.exports = {

  status: Message => {
    LatestStatus = Message
    _SendStatus();
  },
  
  init: RED => {
    _RED = RED

    RED.httpAdmin.get('/zwave-js/fetch-driver-status', function (req, res) {
      res.status(200).end()
      _SendStatus()
    })
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

      if (!Controller) return res.status(404).end() // Controller not found

      let timeout = setTimeout(() => res.status(504).end(), 5000) // Request to controller timed out

      Controller.request(
        { payload: req.body }, // Pass request packet to controller
        zwaveRes => {
          // Response from controller...
          clearTimeout(timeout) // Cancel timeout
          if (!req.body.noWait) res.send(zwaveRes.payload) // Don't send if .noWait was specified
        },
        err => {
          if(err){
            clearTimeout(timeout) // Cancel timeout
            if (!req.body.noWait) res.status(500).send(err.message) // Don't send if .noWait was specified
          }
        }
      )
      if (req.body.noWait) res.status(202).end() // Acknowledge receipt of request if not waiting for response
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
          if(event === "node added"){
            WireNodeEvents(args[0])
          }
          _RED.comms.publish(`/zwave-js/${homeId}`, {
            type: 'controller-event',
            event
          })
        })
      })

      // Node Status
      let emitNodeStatus = status => node => {
        _RED.comms.publish(`/zwave-js/${homeId}`, {
          type: 'node-status',
          node: node.id,
          status
        })
      }
      let emitNodeAsleep = emitNodeStatus('ASLEEP')
      let emitNodeAwake = emitNodeStatus('AWAKE')
      let emitNodeDead = emitNodeStatus('DEAD')
      let emitNodeAlive = emitNodeStatus('ALIVE')

      // Node Event (Value)
      let emitNodeEvent = type => (node, payload) => {
        _RED.comms.publish(`/zwave-js/${homeId}/${node.id}`, {
          type,
          payload
        })
      }
      let emitNodeValue = emitNodeEvent('node-value')
      let emitNodeMeta = emitNodeEvent('node-meta')

      let WireNodeEvents = node => {
          // Status
          node.on('sleep', emitNodeAsleep)
          node.on('wake up', emitNodeAwake)
          node.on('dead', emitNodeDead)
          node.on('alive', emitNodeAlive)
  
          // Readiness
          node.on('ready', node => {
            emitNodeStatus('ready')(node)
          })
  
          // Values
          node.on('value added', emitNodeValue)
          node.on('value updated', emitNodeValue)
          node.on('value removed', emitNodeValue)
          node.on('value notification', emitNodeValue)
          node.on('notification', emitNodeValue)
  
          // Meta
          node.on('metadata update', emitNodeMeta)
      }

      controller.nodes.forEach(node => {

        WireNodeEvents(node)
     
      })
    })
  },
  unregister: homeId => {
    delete CONTROLLERS[homeId]
    // Driver (and listeners) will be destroyed by main module, so nothing else to do here
  }
}
