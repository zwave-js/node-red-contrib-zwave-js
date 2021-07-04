# Please transition to the new API's

In V4, I have decided to completely overhall the APIs that this node exposes.  
Over the last few months, I have become increasingly unhappy, in that the node hides the methods and CC names, that are actually being called up on.

The old APIs are now set for removal and will be removed in the next major release (wich will happen fairly rapidly)

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

In V4, there now new properties named ```mode```, ```cc``` & ```method```.  
This ```mode``` property instructs the node what API should be used.

Let's look at the Wake Up CC using the new API
```javascript
/* Wake Up CC */
{
  payload: {
    node: 2,
    mode: "CCAPI",
    cc: "Wake Up",
    method: "setInterval",
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
    method: "setValue",
    params: [ValueID,3600] 
  }
}
```

This new design has Massive amounts of benenfit - espcially with the CC API Approach (AKA Managed)  
It means, the what was called Managed Mode - can now use Any CC that is offered by Z-Wave JS

Here is the ```mode``` and ```method``` list
 - CCAPI
   - ```method``` is only limited to what is supported on the ```cc``` and ```cc``` is only limited by Z-Wave JS
 - ValueAPI
   - getDefinedValueIDs
   - getValueMetadata
   - getValue
   - setValue
   - pollValue
 - ControllerAPI
   - beginFirmwareUpdate
   - abortFirmwareUpdate
   - getRFRegion
   - setRFRegion
   - toggleRF
   - getNodes
   - keepNodeAwake
   - getNodeNeighbors 
   - setNodeName
   - setNodeLocation
   - refreshInfo
   - hardReset
   - beginHealingNetwork
   - stopHealingNetwork
   - removeFailedNode
   - replaceFailedNode
   - beginInclusion
   - stopInclusion
   - beginExclusion
   - stopExclusion
   - proprietaryFunction
 - DriverAPI
   - getEnums
   - getValueDB
 - AssociationsAPI
   - getAssociationGroups
   - getAllAssociationGroups
   - getAssociations
   - getAllAssociations
   - addAssociations
   - removeAssociations
   - removeNodeFromAllAssociations

Any ```method``` or ```cc``` will now use the **Real** name as used in Z-Wave JS  
[See here for CC names](https://zwave-js.github.io/node-zwave-js/#/api/CCs/index) - minus the "CC" part

Example CC: ```WakeInterval``` -> ```Wake Up```  
Example Method: ```Set``` -> ```setInterval```

## The 'What should I do' approach
 - Add a new ```mode``` property this should be either:  CCAPI | ControllerAPI | DriverAPI | AssociationsAPI | ValueAPI
 - ```class``` should now be renamed to ```cc``` - and only be used for the CCAPI ```mode```
 - ```operation``` should now be renamed to ```method``` this value is determined by what mode (and ```cc``` if using CCAPI) you are using.

