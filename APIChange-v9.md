# New API (9.0.0) Migration Guide

V9 begins the take down of the old API introduced in v4.

The old APIs are now set for removal and will be removed very quicky.  
Below, I set out the changes that you will need to make - and I suggest you make these changes after updating to V9.

without further ado.

Every command is now designed to be a consistant format, and the following `payload` will now be as follows

```javascript
cmd:{
    api: 'CONTROLLER' | 'VALUE' | 'CC' | 'NODE',   /* The API you want to use  */
    method: string                                 /* The method you are executing on this API  */
},
cmdProperties:{
    commandClass: number,                          /* The Command class ID (CC API) */
	method: string,                                /* The CC's method you want to execute (CC API) */    
	endpoint: number,                              /* The endpoint you wish to target (CC API) */ 
	value: any,                                    /* The Value you are providing (VALUE API) */
	valueId: object;                               /* The ValueID you are targeting (VALUE API) */
	setValueOptions: object;                       /* Set Value (VALUE API) */
	args: any[];                                   /* The args for the command you are calling (CC API) */
}
```

## Right!! so what do i do (we'll use the Wake Up CC for demonstration)
```javascript
/* This */
let Message = {
    payload: {
        node: 37,
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
            nodeId: 37
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
 payload: {
        cmd: {
           api: 'VALUE',
           method: 'setValue'
        },
        cmdProperties: {
            nodeId: 5,
            valueId : <ValueID>
            value: 3600
        }
    }
return Message;
```


