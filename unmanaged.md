# Unmanaged Mode.  
  
 - Uses the Z-Wave JS Value API
 - Ensures any Set Command is followed up with an Updated value event
 - Command class support is only limited by whats supported in Z-Wave JS
 - Limited in what can be done, ex: No transition times. Its mainly for primitive types.

There is only 4 commands to use here.

| class                     | operation                           | params                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Unmanaged                 | GetDefinedValueIDs                  |                                                       | 
| Unmanaged                 | SetValue                            | [ValueID, Value]                                      |
| Unmanaged                 | GetValue                            | [ValueID]                                             |  
| Unmanaged                 | GetValueMetadata                    | [ValueID]                                             |  

## Example 101  
**NOTE:** You do not need to specify the ```node``` property IF the message, is going through the **ZWave Device** node.  

```javascript
/* Get all ValueID's for a node */

let Message = {
    payload: {
        node: 2,
        class: "Unmanaged",
        operation: "GetDefinedValueIDs"
    }
}
return Message
```

```javascript
/* Set a value */
/* NOTE : setValue only supports providing 2 params, the ValueID its self, and the value to set. */
/*        ValueID will be one of the obejcts (not actual IDs) returned from GetDefinedValueIDs                   */

let Message = {
    payload: {
        node: 2,
        class: "Unmanaged",
        operation: "SetValue",
        params: [ValueID, Value]
    }
}
return Message
```

```javascript
/* Get a value */
/* NOTE : using getValue will return the cached value, and may not represent the current value. */
/*        getValue should not be used for poling the device                                     */

let Message = {
    payload: {
        node: 2,
        class: "Unmanaged",
        operation: "GetValue",
        params: [ValueID]
    }
}
return Message
```