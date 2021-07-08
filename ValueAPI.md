# The Value API (mode: ValueAPI).  
  
 - Uses the Z-Wave JS Value API
 - Ensures any Set method is followed up with an Updated value event
 - A little trickier for beginners.
 - May not work with all CC's (especially those with complex values)

This mode can be seen as 'bossing it', its a little more involved, but is preferred by the pro's

| method                              | params                                                |
| ----------------------------------- | ----------------------------------------------------- |
| getDefinedValueIDs                  |                                                       | 
| getValueMetadata                    | [ValueID]                                             |  
| setValue                            | [ValueID, Value, Options (Optional)]                  |
| getValue                            | [ValueID]                                             |  
| pollValue                           | [ValueID]                                             |  

## getValue V pollValue
The Z-Wave JS Value API works with a cache database.  
that is, the result you get from **getValue** is from a cache, and not directly from the device.  
The cache of course, should under normal circumstance, remain updated, as and when devices send updates.

This cache is restored on start up, so any calls to **getValue**, will return what the last known value was.  

This is where **pollValue** comes handy.  
Under normal circumstance, **pollValue** is unnecessary - as the cache will usally be upto date.  
But if you're recovering from some downtime, the cahced values may be too far out of date.  
**pollValue** will allow you to force an update on a value - it will essentially query the device for the latest value,  
and will as a result, update the cache.

## Example 101  
**NOTE:** You do not need to specify the ```node``` property IF! the message, is going through the **ZWave Device** node.  

```javascript
/* Get all ValueID's for a node */
/* NOTE: You can also obtain the ValueID for a given property, by double clicking it in the GUI */

let Message = {
    payload: {
        node: 2,
        mode: "ValueAPI",
        method: "getDefinedValueIDs"
    }
}
return Message
```

```javascript
/* Set a value */

let Options = {
    transitionDuration:"1m10s"
}

let Message = {
    payload: {
        node: 2,
        mode: "ValueAPI",
        method: "setValue",
        params: [ValueID, Value, Options] // Options is not required
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
        mode: "ValueAPI",
        method: "getValue",
        params: [ValueID]
    }
}
return Message
```
