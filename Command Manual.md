# node-red-contrib-zwave-js


### Command Manual  
The below table show the avalbale API's exposed by each node Type.  
To construct a command, you will send the following `payload`

```
{
    cmd: {
        api: 'NODE' | 'VALUE' | 'CONTROLLER' | 'DRIVER',
        method: <See Below> 
    },
    cmdProperties: {
        // See table below for required properties
    }
}
```
What is available to each Node in your flow, is listed below.

 - Where a property has brackets = optional  
   Noting some are required (exampe `args` for the method `invokeCCAPI` -> `set` )

The **Device** Node
--------

| API | Method | CMD Properties | 
|-----|--------| ---------------|
| `NODE` | `ping` | `nodeId` |
| `NODE` | `refreshInfo` | `nodeId` |
| `NODE` | `setName` | `nodeId`, `value` |
| `NODE` | `setLocation` | `nodeId`, `value` |
| `VALUE` | `setValue` | `nodeId`, `valueId`, `value`, `[setValueOptions]` |
| `VALUE` | `getValue` | `nodeId`, `valueId` |
| `VALUE` | `pollValue` | `nodeId`, `valueId` |
| `CC` | `invokeCCAPI` | `nodeId`, `commandClass`, `method`, `endpoint`, `[args]` |

The **Controller Node** 
--------

 - The **Controller** Node supports all APIs provided by the Device Node, plus the following:

| API | Method | CMD Properties | 
|-----|--------| ---------------|
| `CONTROLLER` | `getNodes` | |
| `CONTROLLER` | `proprietaryFunction` | `args`|
| `DRIVER` | `getValueDB` | `[nodeId]`|



