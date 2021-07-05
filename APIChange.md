# New API Migration Guide

In V4, I have decided to completely overhall the APIs that this node exposes.  
Over the last few months, I have become increasingly unhappy, in that the node hides the methods and CC names, that are actually being called up on.

The old APIs are now set for removal and will be removed in the next major release (wich will happen fairly rapidly).  
Below, I set out the changes that you will need to make - and I suggest you make these changes after updating to V4.

## ```class``` is now ```mode```
Currently, a ```class``` property specifies the area of interest that you are targeting.  
This can be ```Unmanaged```, ```Controller```, ```Driver```, ```Associations``` or a name of a Z-Wave Class.

This is wrong! And is now scrapped - it has been replaced with a ```mode``` property.  
This ```mode``` property now instructs the module as to what API is to be used for your message.

Possible values are:
 - ```CCAPI``` : The Z-Wave JS Command Class API
 - ```ValueAPI``` : The Z-Wave JS Value API
 - ```ControllerAPI``` : Controller based functions
 - ```DriverAPI``` : Driver based functions
 - ```AssociationsAPI``` : Association based functions
 
## New ```cc``` property
If you were using a named ZWave class i.e ```BasicSwitch```, this new property is used to specify such class.  
Not only that - but the class names are now as they appear in Z-Wave JS.

## ```operation``` is now ```method```
This property now specfies the method that is to be called, and will differ based on the ```mode``` (and ```cc``` if using ```CCAPI```) that you are using.  
The method names are now as they appear in Z-Wave JS.

## Right!! so what do i do
```javascript
/* This */
let Message = {
    payload: {
        node: 5,
        class: "WakeInterval",
        operation: "Set",
        params: [3600]
    }
}
return Message;

/* Is now this */
let Message = {
    payload: {
        node: 5,
        mode: "CCAPI",
        cc: "Wake Up",
        method: "setInterval",
        params: [3600]
    }
}
return Message;
```

```javascript
/* And this */
let Message = {
    payload: {
        node: 5,
        class: "Unmanaged",
        operation: "SetValue",
        params: [ValueAPI,3600]
    }
}
return Message;

/* Is now this */
let Message = {
    payload: {
        node: 5,
        mode: "ValueAPI",
        method: "setValue",
        params: [ValueID,3600]
    }
}
return Message;
```

This new design has massive amounts of benefit - espcially with the CC API Approach (fomerly Managed)  
It means, any CC that is offered by Z-Wave JS, can now be used without needing to use the Value API (fomerly Unmanaged)  

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


   ## Duration is no longer an Object
   Specifying a duration is no longer achived using an Object, it is now a string.

```javascript
/* This */
let MyDuration = {
    Duration: {
        value: 70,
        unit: "seconds"
    }
}
let Message = {
    payload: {
        ....
        params: [35, MyDuration]
    }
}
return Message;

/* Is now this */
let Message = {
    payload: {
        ....
        params: [35, "1m10s"]
    }
}
return Message;
```

