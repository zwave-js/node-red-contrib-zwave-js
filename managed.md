# Managed Mode.  

 - Uses the Z-Wave JS Command Classes API
 - Does not verify that any Set commands have been confirmed by your device,  
   its upto the device to send a value update (specifications suggest they should).
 - Command Class support is specifically developed (listed below)
 - The Node Red plugin its self, is doing a lot of the heavy lifting
  
Some CCs require a JSON Object, which are documented at the bottom.  
For those CCs that require an Enum value however, you can get all the valid Enums, by sending the following message:  
```javascript
let Message = {
    payload: {
        class: "Driver",
        operation: "GetEnums"
    }
}
return Message
```
Currently, the supported command classes are (when using Managed mode).  

| class                              | operation                           | params                                                |
| ---------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Association (Deprecated)           | GetGroup                            | [Group ID: Number]                                    |
| Association (Deprecated)           | AddNodes                            | [Group ID: Number, NodeIDs: Number[]]                 |
| Association (Deprecated)           | RemoveNodes                         | [**RemoveOptions**: Object]                           |
| Association (Deprecated)           | RemoveNodesFromAllGroups            | [NodeIDs: Number[]]                                   |
| Association (Deprecated)           | GetGroupCount                       |                                                       |
| AssociationGroupInfo (Deprecated)  | GetGroupName                        | [Group ID: Number]                                    |
| Basic                              | Set                                 | [Number]                                              |
| Basic                              | Get                                 |                                                       |
| Battery                            | Get                                 |                                                       |
| BinarySensor                       | Get                                 | [**BinarySensorType**: Enum]                          |
| BinarySwitch                       | Set                                 | [Bool, **Duration**: Object (Optional)]               |
| BinarySwitch                       | Get                                 |                                                       |
| Configuration                      | Set                                 | [ParamID: Number, Value: Number, Value Length: Number]|
| Configuration                      | Get                                 | [ParamID: Number]                                     |
| ColorSwitch                        | Set                                 | [**Color**: Object]                                   |
| ColorSwitch                        | Get                                 | [**ColorComponent**: Enum]                            |
| DoorLock                           | Set                                 | [**DoorLockMode**: Enum]                              |
| DoorLock                           | Get                                 |                                                       |
| EntryControl                       | SetConfiguration                    | [Key Cache Size: Number, Cache Timeout: Number]       |
| EntryControl                       | GetConfiguration                    |                                                       |
| EntryControl                       | GetSupportedKeys (see notes)        |                                                       |
| Lock                               | Set                                 | [Bool]                                                |
| Lock                               | Get                                 |                                                       |
| Indicator                          | Set                                 | [Value: Number] \| [**Indicator**[]: Object]          |
| Indicator                          | Get                                 | [Indicator: Number (Optional)]                        |
| Meter                              | Get                                 | [**MeterOptions**: Object]                            |
| Meter                              | GetAll                              |                                                       |
| Meter                              | Reset                               | [**MeterResetOptions**: Object]                       |
| MultiLevelSwitch                   | Set                                 | [Number, **Duration**: Object (Optional)]             |
| MultiLevelSwitch                   | Get                                 |                                                       |
| MultiLevelSensor                   | Get                                 |                                                       |
| MultiLevelSensor                   | GetSupportedScales                  | [Sensor Type: Number]                                 |
| MultiLevelSensor                   | GetSupportedSensorTypes             |                                                       |
| Notification                       | SendReport                          | [**Event**: Object]                                   |
| SoundSwitch                        | GetConfiguration                    |                                                       |
| SoundSwitch                        | SetConfiguration                    | [Default Tone: Number, Default Volume: Number]        |
| SoundSwitch                        | GetPlaying                          |                                                       |
| SoundSwitch                        | GetToneCount                        |                                                       |
| SoundSwitch                        | GetToneInfo                         | [Tone ID: Number]                                     |
| SoundSwitch                        | Play                                | [Tone ID: Number, Volume: Number (Optional)]          |
| SoundSwitch                        | Stop                                |                                                       |
| ThermostatMode                     | Set                                 | [**ThermostatMode**: Enum]                            |
| ThermostatMode                     | Get                                 |                                                       |
| ThermostatSetPoint                 | Set                                 | [**SetPointType**: Enum, Value: Number, Scale: Number] |
| ThermostatSetPoint                 | Get                                 | [**SetPointType**: Enum]                              | 
| ThermostatOperatingState           | Get                                 |                                                       | 
| ThermostatSetback                  | Set  (See Notes)                    | [**SetbackType**: Enum, Set Back State: String \| Number] | 
| ThermostatSetback                  | Get                                 |                                                       | 
| WakeInterval                       | Set (See Notes)                     | [Seconds: Number, Controller Node ID:Number]          |
| WakeInterval                       | Get                                 |                                                       | 

The aim of course is to expose them all.

## Example 101  
See below, for examples on how to interrogate the CC's in the table above.  
**NOTE:** You do not need to specify the ```node``` property IF the message, is going through a **ZWave Device** node.  

```javascript
/* Set a configuration value for a zwave node */

let Message = {
    payload: {
        node: 2,
        class: "Configuration",
        operation: "Set",
        params: [0x18, 0x03, 1] // Config Param, Config Value, Value Size
    }
}
return Message
```

```javascript
/* Get a configuration value from a zwave node */
/* The result will be injected into your flow */

let Message = {
    payload: {
        node: 2,
        class: "Configuration",
        operation: "Get",
        params: [0x18] // Config Param
    }
}
return Message
```

```javascript
/* Support for multi-channel devices. i.e Wall sockets with multiple outlets */

let Message = {
    payload: {
        node: 2,
        class: "BinarySwitch",
        operation: "Set",
        endpoint: 1, // zero based index. 0 - First outlet, 1 - second outlet and so on.
        params: [true]
    }
}
return Message
```

```javascript
/* Issue a notification report */

let Report = {
    notificationType: 0x06,
    notificationEvent: 0x16
}

Let Message = {
    payload: {
        node: 2,
        class: "Notification",
        operation: "SendReport",
        params: [Report]
    }
}
return Message
```

## Forcing Updates
If you prefer Managed Mode, but have devices (or endpoints), that do not report back updated values,
you can enforce an update by suppplying a **forceUpdate** object, and providing  
a **property** and optionally **propertyKey** - both of which are avalable in VALUE_UPDATED events.  

This will cause extra traffic in your network, so only use this if needed.

```javascript
let Message = {
    payload: {
        node: 12,
        class: "BinarySwitch",
        operation: "Set",
        endpoint: 2,
        forceUpdate: {
          property: "currentValue"
        },
        params: [true]
    }
}
return Message
```

## Deprecated Association and AssociationGroupInfo
These class' and operations will be removed in a future release  
Please see the [&#x1F517;Associations](./README.md#controllerdriver-and-association-based-operations) class of operations:  
  - GetAssociationGroups
  - GetAllAssociationGroups
  - GetAssociations
  - GetAllAssociations
  - AddAssociations
  - RemoveAssociations
  - RemoveNodeFromAllAssociations


## Notes on WakeInterval  
When setting the interval, the **Controller Node ID** parameter will almost certainly be 1 - unless you have multiple controllers,
and you want the wake up to be recieved by a different controller. 

## Notes on GetSupportedKeys
This will return an array of ASCII codes - representing the keys that are supported on the device  

## Notes on ThermostatSetback  
If specifing a string, the valid values are: **Frost Protection** | **Energy Saving** | **Unused**

## Object Structures  

**MeterOptions**
```javascript
{
  scale: Number,
  rateType: Enum (RateType)
}
```

**MeterResetOptions**
```javascript
{
  type: Number,
  targetValue: Number
}
```

**Event**
```javascript
{
  notificationType: Number,
  notificationEvent: Number,
  eventParameters: Buffer (Optional),
  sequenceNumber: Number (Optional)
}
```

**RemoveOptions**
```javascript
{
  groupId: Number,
  nodeIds: Number[]
}
```

**Duration**
```javascript
{
  Duration: {
    value: Number,
    unit: "seconds" | "minutes",
  }
}
```

**Color**
```javascript
{
  hexColor: "#000000"
}
```

**Indicator**
```javascript
{
  indicatorId: Number,
  propertyId: Number,
  value: Number | Bool,
}
```