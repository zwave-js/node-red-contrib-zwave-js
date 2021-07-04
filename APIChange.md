# Please transition to the new API's

In V4, I have decided to comletely overhall the APIs that this node exposes.  
Over the last few months, I have become increasingly unhappy, in that the node hides the methods and CC names, that are actually being called up on.

Currently, you target the various APIs using the **class** property in your message.


```javascript
/* The Command Calss API Approach */

/* Wake Up CC */
/
{
  payload: {
    node: 2,
    class: "WakeInterval"
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
    class: "Unmanaged"
    operation: "Set",
    params: [ValueID, Value] 
  }
}
```

Taking the above Value API approach, what is actually happening behid the scene is this:  
```Driver.Controller.nodes.get(2).setValue(ValueID, Value)```

And the CC API approach, is using an awkward Look up table, to find the correct method.

In V4, there is now a new property named ```mode```.  
This mode property tell the node to what API you are using.

