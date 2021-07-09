# The Command Class API (mode: CCAPI).  

 - Uses the Z-Wave JS Command Classes API
 - Does not verify that any Set commands has been confirmed by your device,  
   its upto the device to send a value update (specifications suggest they should).
 - Easier to understand
  
This mode is a no fuss approach, set the CC, method and provide any values that it needs

## Example 101  
**NOTE:** You do not need to specify the ```node``` property IF the message, is going through a **ZWave Device** node.  

```javascript
/* Set a configuration value for a zwave node */

let Message = {
    payload: {
        node: 2,
        mode: "CCAPI",
        cc: "Configuration",
        method: "set",
        params: [0x18, 0x03, 1] // Config Param, Config Value, Value Size
    }
}
return Message
```

```javascript
/* Get a configuration value from a zwave node */
/* The result will be injected into your flow */

let Message = {
    payload: {
        node: 2,
        mode: "CCAPI",
        cc: "Configuration",
        method: "get",
        params: [0x18] // Config Param
    }
}
return Message
```

```javascript
/* Specifying a duration for supported CC's */

let Message = {
    payload: {
        node: 2,
        mode: "CCAPI",
        cc: "Multilevel Switch",
        method: "set",
        params: [30,"1m10s"] //Value, Duration
    }
}
return Message
```

```javascript
/* Support for multi-channel devices. i.e Wall sockets with multiple outlets */

let Message = {
    payload: {
        node: 2,
        cc: "Binary Switch",
        method: "set",
        endpoint: 1, // zero based index. 0 - First outlet, 1 - second outlet and so on.
        params: [true]
    }
}
return Message
```

```javascript
/* Issue a notification report */

let Report = {
    notificationType: 0x06,
    notificationEvent: 0x16
}

Let Message = {
    payload: {
        node: 2,
        mode: "CCAPI",
        cc: "Notification",
        method: "sendReport",
        params: [Report]
    }
}
return Message
```

## Forcing Updates
If you prefer the CC API, but have devices (or endpoints), that do not report back updated values,  
you can enforce an update by suppplying a **forceUpdate** object, and providing  
properties normally found in **VALUE_UPDATED** events, namely **property** and sometimes **propertyKey**.  

Whilst you can overwrite the force update request and set **endpoint** and **commandClass**,  
Unless there is a specific reason to do so, it's best to allow the system to take care of this for you.

This will cause extra traffic in your network, so only use this if needed.

```javascript
let Message = {
    payload: {
        node: 12,
        mode: "CCAPI",
        cc: "Binary Switch",
        method: "set",
        endpoint: 2,
        forceUpdate: {
          property: "currentValue"
        },
        params: [true]
    }
}
return Message
```

For a list of CC's, please view the Z-Wave JS documentation [Here](https://zwave-js.github.io/node-zwave-js/#/api/CCs/index)
