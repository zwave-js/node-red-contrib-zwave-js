# New API (9.0.0) Migration Guide

V9 begins the take down of the old API introduced in v4.

The old APIs are now set for removal and will be removed in V10.  
Below, I set out the changes that you will need to make - and I suggest you make these changes after updating to V9.

without further ado.

Every command is now designed to be a consistant format, and the  `payload` below will be the new format.  
The reason for this change, is to make it easier for you (and me), to identify parts of the payload.

Previously, setting a value using the Value API for instance, will involve sending an array of objects without any clue as to what they really are, this new format will address that.



## Notes

During this transition, the following APIs will be available using the new format : `DRIVER`, `ASSOCIATIONS`
However, these will form part of the combined `CONTROLLER` API when V10 lands.

The properties `responseThroughEvent` and `forceUpdate` will be supported in the new message format (at the root of `payload`)
but support for them will be removed in V10 (please see change log)

The `Node` API will be available in V10 and will house the `setName`, `setLocation` methods as well as a few new one 😃



```javascript
cmd:{
    api: 'CONTROLLER' | 'VALUE' | 'CC' | 'NODE',  /* The API you want to use  */
    method: string                                /* The method you are executing on this API  */
},
cmdProperties:{

    nodeId: number,                               /* The target Node ID */

    /* CC API */
    commandClass: number,                         /* The Command class ID (CC) */
    method: string,                               /* The CC's method you want to execute (CC) */    
    endpoint: number,                             /* The endpoint you wish to target (CC) */

    /* CC, CONTROLLER API */
    args: any[],                                  /* The args for the command you are calling (CC, CONTROLLER) */

    /* VALUE API */
    valueId: object,                              /* The ValueID you are targeting (VALUE) */
    setValueOptions: object,                      /* Set Value Options (VALUE) */

    /* VALUE, NODE API */
    value: any,                                   /* The Value you are providing (VALUE, NODE) */

}
```

## Right!! so what do i do (we'll use the Wake Up CC for demonstration)
```javascript
/* This */
let Message = {
    payload: {
        node: 37,
        mode: "CCAPI",
        class: "Wake Up",
        method: "setInterval",
        params: [3600]
    }
}
return Message;

/* Is now this */
let Message = {
    payload: {
        cmd: {
           api: 'CC',
           method: 'invokeCCAPI'
        },
        cmdProperties: {
            nodeId: 37,
            commandClass: 0x84,
            method: 'setInterval',
            args: [3600]
        }
    }
}
return Message;
```

```javascript
/* And this */
let Message = {
    payload: {
        node: 5,
        mode: "ValueAPI",
        method: "setValue",
        params: [<ValueID>,3600]
    }
}
return Message;

/* Is now this */
let Message = {
    payload: {
        cmd: {
            api: 'VALUE',
            method: 'setValue'
        },
        cmdProperties: {
            nodeId: 5,
            valueId: <ValueID>,
            value: 3600
        }
    }
}
return Message;
```


