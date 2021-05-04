# Unmanaged Mode.  
  
 - Uses the Z-Wave JS Value API
 - Ensures any Set Command is followed up with an Updated value event
 - Command class support is only limited by whats supported in Z-Wave JS
 - Limited in what can be done, ex: No transition times. Its mainly for primitive types.

Here is what you can do.

| class                     | operation                           | params                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Unmanaged                 | GetDefinedValueIDs                  |                                                       | 
| Unmanaged                 | GetValueMetadata                    | [ValueID]                                             |  
| Unmanaged                 | SetValue                            | [ValueID, Value]                                      |
| Unmanaged                 | GetValue                            | [ValueID]                                             |  
| Unmanaged                 | GetAllValues                        |                                                       |  
| Unmanaged                 | PollValue                           | [ValueID]                                             |  

## GetValue V PollValue
The Z-Wave JS Value API works with a cache database.  
that is, the result you get from **GetValue**/**GetAllValues** is from a cache, and not directly from the device.  
The cache of course, should under normal circumstance, remain updated, as and when devices send updates.

This cache is restored on start up, so any calls to the Get methods, will return what the last known value was.  

This is where **PollValue** comes handy.  
Under nornal circumstance, **PollValue** is unnecessary - as the cache will usally be upto date.  
But if you're recovering from some downtime, the cahced values, may be too far out of date.  
**PollValue** will allow you to force an update, on a value - it will essentially query the device for the latest value.  

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