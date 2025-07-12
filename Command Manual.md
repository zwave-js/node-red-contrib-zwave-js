# node-red-contrib-zwave-js


### Command Manual  
The below table show the available API's exposed by each node type.  
To construct a command, you will send the following `payload`

```js
{
    cmd: {
        api: 'NODE' | 'VALUE' | 'CONTROLLER' | 'DRIVER',
        method: // See below
    },
    cmdProperties: {
        // See below
    }
}
```
What is available to each Node in your flow, is listed below.

 - Where a property is shown in brackets, it is optional.
 - But some fields are required — for example, `args` is required for the `invokeCCAPI` method (e.g. when using `set`).

The Device Node
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

The Controller Node
--------

 - The **Controller** Node supports all APIs provided by the Device Node, plus the following:

| API | Method | CMD Properties | 
|-----|--------| ---------------|
| `CONTROLLER` | `getNodes` | |
| `CONTROLLER` | `proprietaryFunction` | `args`|
| `DRIVER` | `getValueDB` | `[nodeId]`|

The valueId object
--------
The **valueId** is an object that denotes the value for a specific endpoint on a device.  
The below is to identify the Target Value on a MultiLevel switch on Endpoint 3

```js
{
    commandClass: 38,         /* MultiLevel Switch CC  */
    endpoint: 3,              /* Endpoint 3            */
    property: "targetValue"   /* Property on this CC   */
}
```

Some CC values, have sub properties, and these are refefrenced via the **propertyKey**  
Example : the Central Scene CC (Scene 4)

```js
{
    commandClass: 91,        /* Central Scene CC  */
    endpoint: 0,             /* Endpoint 0        */
    property: "scene",       /* Scene Proprety    */
    propertyKey: "004"       /* Scene 4           */
}
```



