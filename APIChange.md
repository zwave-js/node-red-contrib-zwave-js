# Please transition to the new API's

In V4, I have decided to comletely overhall the APIs that this node exposes.  
Over the last few months, I have become increrasingly unhappy in that the  node hides the methods and CC names.

Currently, you target the various APIs using the **class** property in your message.


```javascript
/* The Command Calss API Approach */

/* Configuration CC */

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