# Unmanaged Usage.  
  
Unmanaged usage, is more involved, and generally requires a little more understanding and poses certain limits on what can be done.  
However, the reward here, is that Command Class support is only limited by ZWave-JS.  

The difference with this approach, is that you supply a [&#x1F517;ValueID](https://zwave-js.github.io/node-zwave-js/#/api/valueid)  
The ValueID interface uniquely identifies to which CC, endpoint and property a value belongs to.  
These methods directly interact with the Z-Wave JS Value API.  

There is only 4 commands to use here.

| class                     | operation                           | params                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Unmanaged                 | GetDefinedValueIDs                  |                                                       | 
| Unmanaged                 | SetValue                            | [ValueID, Value]                                      |
| Unmanaged                 | GetValue                            | [ValueID]                                             |  
| Unmanaged                 | GetValueMetadata                    | [ValueID]                                             |  

## Example 101  
**NOTE:** You do not need to specify the ```node``` property IF the message, is going through the **ZWave Device** node.  

```
/* Get all ValueID's for a node */
{
  payload: {
    node: 2,
    class: "Unmanaged",
    operation: "GetDefinedValueIDs"
  }
}
```

```
/* Set a value */
/* NOTE : setValue only supports providing 2 params, the ValueID its self, and the value to set. */  
/* ValueID will be one of the ValueIDs returned from GetDefinedValueIDs                          */
{
  payload: {
    node: 2,
    class: "Unmanaged",
    operation: "SetValue",
    params: [ValueID,Value]
  }
}
```

```
/* Get a value */
/* NOTE : using getValue will return the cached value, and may not represent the current value. */
/*        getValue should not be used for poling the device                                     */  
{
  payload: {
    node: 2,
    class: "Unmanaged",
    operation: "GetValue",
    params: [ValueID]
  }
}
```