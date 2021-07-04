# Please transition to the new API's

In V4, I have decided to completely overhall the APIs that this node exposes.  
Over the last few months, I have become increasingly unhappy, in that the node hides the methods and CC names, that are actually being called up on.

Currently, you target the various APIs using the **class** property in your message.

```javascript
/* The Command Calss API Approach */

/* Wake Up CC */
{
  payload: {
    node: 2,
    class: "WakeInterval",
    operation: "Set",
    params: [3600] 
  }
}
```

```javascript
/* The Value API Approach */

/* Set */
{
  payload: {
    node: 2,
    class: "Unmanaged",
    operation: "Set",
    params: [ValueID, Value] 
  }
}
```

Taking the above Value API approach, what is actually happening behind the scene is this:  
```Driver.Controller.nodes.get(2).setValue(ValueID, Value)```

And the CC API approach, is using an awkward Look up table, to find the correct CC/Method.

In V4, there is now a new property named ```mode```.  
This ```mode``` property instructs the node what API should be used.

Let's look at the Wake Up CC using the new API
```javascript
/* Wake Up CC */
{
  payload: {
    node: 2,
    mode: "CCAPI",
    class: "Wake Up",
    operation: "setInterval",
    params: [3600] 
  }
}
```

And the Value API approach
```javascript
{
  payload: {
    node: 2,
    mode: "ValueAPI",
    operation: "setValue",
    params: [ValueID,3600] 
  }
}
```

This new design has Massive amounts of benenfit - espcially with the CC API Approach (AKA Managed)  
It means, the what was called Managed Mode - can now use Any CC that is offered by Z-Wave JS

Here is the ```mode``` and ```operation``` list
 - CCAPI
   - ```operation``` is only limited to what is supported on the ```class```
 - ValueAPI
   - getDefinedValueIDs
   - getValueMetadata
   - getValue
   - setValue
   - pollValue
 - ControllerAPI
 - DriverAPI
 - AssociationsAPI

Any operation or class will now use the **Real** name as used in Z-Wave JS  
Example CC: ```WakeInterval``` -> ```Wake Up```  
Example Operation: ```Set``` -> ```setInterval```


