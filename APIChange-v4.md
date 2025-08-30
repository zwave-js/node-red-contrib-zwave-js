# New API (4.0.0) Migration Guide

In V4, I have decided to completely overhall the APIs that this node exposes.  
Over the last few months, I have become increasingly unhappy, in that the node hides the methods and CC names, that are actually being called up on.

The old APIs are now set for removal and will be removed very quicky.  
Below, I set out the changes that you will need to make - and I suggest you make these changes after updating to V4.

without further ado.  

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
This property is only required if ```mode``` is set to ```CCAPI```.  
Lastly, the class names should now be as they appear in Z-Wave JS.

## ```operation``` is now ```method```
This property now specfies the method that is to be called, and will differ based on the ```mode``` (and ```cc``` if using ```CCAPI```) that you are using.  
The method names should be as they appear in Z-Wave JS.

## Right!! so what do i do (we'll use the Wake Up CC for demonstration)
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
        params: [<ValueAPI>,3600]
    }
}
return Message;

/* Is now this */
let Message = {
    payload: {
        node: 5,
        mode: "ValueAPI",
        method: "setValue",
        params: [<ValueID>,3600]
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
   - proprietaryFunction
 - DriverAPI
   - getValueDB
   - getNodeStatistics
   - getControllerStatistics
 - AssociationsAPI
   - getAssociationGroups
   - getAllAssociationGroups
   - getAssociations
   - getAllAssociations
   - addAssociations
   - removeAssociations
   - removeNodeFromAllAssociations

## Duration is no longer an Object
Specifying a duration is no longer achieved using an Object, it is now a string.

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

One of the aims with these API changes, was to allow more dynamic handling with Z-Wave JS, i.e if a new CC becomes supported,  
it will 'just work' after bumping the Z-Wave JS lib without any need to code for specifics (as was the old way).

Keep that in mind, for the next 2 chapters :)

## New ```responseThroughEvent``` property.
In Z-Wave JS, a majority of results trigger an event, and it is the contents of that event, that is passed in to your flow.  
For that reason, the call you make, is not doing the return its self - the triggered event is.  
If we were to return the contents of your call, you will end up with duplicated messages (one from the generated event, and one from the call)

However! some methods don't trigger an event, so for these, we do need to return the value that your call produces.  
One example is ```Entry Control``` -> ```getSupportedKeys```, it does not trigger an event.

So, to return the value we set ```responseThroughEvent``` to ```false``` (default is ```true```)

```javascript
let Message = {
    payload: {
       node: 5,
       mode: "CCAPI",
       cc: "Entry Control",
       method: "getSupportedKeys",
       responseThroughEvent: false
   }
}
return Message;
```

## New ```enums``` property.
Some of the CC's use enums for there values, an example is the ```User Code``` CC.  
When creating a new user, you specify the user status, and Z-Wave JS makes it easy to to so, using an Enum as below.

```typescript
export enum UserIDStatus {
    Available = 0x00,
    Enabled,
    Disabled,
    Messaging,
    PassageMode,
    StatusNotAvailable = 0xfe,
}
```

Previously, this module for node red, referenced and converted the values based on known Enums for specific CCs.  
Now however, we no longer know the values in advanced, so you specify the enum to use within the message, allowing a suddenly introdcued CC (that uses Enums) to be used.  
This is done with an ```enums``` property - lest see how we use it.

```javascript
let Message = {
    payload: {
        node: 5,
        mode: "CCAPI",
        cc: "User Code",
        method: "set",
        enums: {1:"UserIDStatus"}, // {Paramater Index: Enum name, Paramater Index: Enum name}
        params: [5,"Enabled","1234"] // User 5, User Status, User Code
    }
}
return Message;
```

The above will convert parameter 1 (the 2nd parameter) to 0x01
