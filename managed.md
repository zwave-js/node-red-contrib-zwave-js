# Managed Usage.  
  
First, lets get out the way, what Managed mode is.  
Managed mode is where the node-red plugin it's self does a lot of the heavy lifting. Locating the correct command class, correct node, its endpoint, so on and so forth.  
Underneath it all, this method uses the Z-Wave JS Command Classes API  

Managed mode, allows easy accesss, the downside with Managed mode, is that command class support needs to be 'Bridged',  
so that the command classes, can be used in an easy way.  

Currently, the supported command classes are (when using Managed mode).  
Some CCs require a JSON Object, which are documented at the bottom.  
For those CCs that require an Enum value, you can get all the valid Enums, by sending the following message:  
```
{
  payload:{
    class: "Driver",
    operation:"GetEnums"
  }
}
```

| class                     | operation                           | params                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Association               | GetGroup                            | [Group ID: Number]                                    |
| Association               | AddNodes                            | [Group ID: Number, NodeIDs: Number[]]                 |
| Association               | RemoveNodes                         | [**RemoveOptions**: Object]                           |
| Association               | RemoveNodesFromAllGroups            | [NodeIDs: Number[]]                                   |
| Association               | GetGroupCount                       |                                                       |
| AssociationGroupInfo      | GetGroupName                        | [Group ID: Number]                                    |
| Basic                     | Set                                 | [Number]                                              |
| Basic                     | Get                                 |                                                       |
| Battery                   | Get                                 |                                                       |
| BinarySensor              | Get                                 | [**BinarySensorType**: Enum]                          |
| BinarySwitch              | Set                                 | [Bool, **Duration**: Object (Optional)]               |
| BinarySwitch              | Get                                 |                                                       |
| Configuration             | Set                                 | [ParamID: Number, Value: Number, Value Length: Number] |
| Configuration             | Get                                 | [ParamID: Number]                                     |
| ColorSwitch               | Set                                 | [**Color**: Object]                                   |
| ColorSwitch               | Get                                 | [**ColorComponent**: Enum]                            |
| DoorLock                  | Set                                 | [**DoorLockMode**: Enum]                              |
| DoorLock                  | Get                                 |                                                       |
| EntryControl              | SetConfiguration                    | [Key Cache Size: Number, Cache Timeout: Number]       |
| EntryControl              | GetConfiguration                    |                                                       |
| EntryControl              | GetSupportedKeys (see notes)        |                                                       |
| Lock                      | Set                                 | [Bool]                                                |
| Lock                      | Get                                 |                                                       |
| Indicator                 | Set                                 | [Value: Number] | [**Indicator**[]: Object]           |
| Indicator                 | Get                                 | [Indicator: Number (Optional)]                        |
| Meter                     | Get                                 | [**MeterOptions**: Object]                            |
| Meter                     | GetAll                              |                                                       |
| Meter                     | Reset                               | [**MeterResetOptions**: Object]                       |
| MultiLevelSwitch          | Set                                 | [Number, **Duration**: Object (Optional)]             |
| MultiLevelSwitch          | Get                                 |                                                       |
| Notification              | SendReport                          | [**Event**: Object]                                   |
| ThermostatMode            | Set                                 | [**ThermostatMode**: Enum]                            |
| ThermostatMode            | Get                                 |                                                       |
| ThermostatSetPoint        | Set                                 | [**SetPointType**: Enum, Value: Number, Scale: Number] |
| ThermostatSetPoint        | Get                                 | [**SetPointType**: Enum]                              | 
| ThermostatOperatingState  | Get                                 |                                                       | 
| ThermostatSetback         | Set  (See Notes)                    | [**SetbackType**: Enum, Set Back State: String | Number] | 
| ThermostatSetback         | Get                                 |                                                       | 
| WakeInterval              | Set (See Notes)                     | [Seconds: Number, Controller Node ID:Number]          |
| WakeInterval              | Get                                 |                                                       | 

The aim of course is to expose them all.

## Example 101  
See below, for examples on how to interrogate the CC's in the table above.  
**NOTE:** You do not need to specify the ```node``` property IF the message, is going through a **ZWave Device** node.  

```
/* Set a configuration value for a zwave node */

{
  payload:{
    node: 2,
    class: "Configuration",
    operation:"Set",
    params: [0x18, 0x03, 1] // Config Param, Config Value, Value Size
  }
}
```

```
/* Get a configuration value from a zwave node */
/* The result will be injected into your flow */

{
  payload:{
    node: 2,
    class: "Configuration",
    operation:"Get",
    params: [0x18] // Config Param
  }
}
```

```
/* Support for multi-channel devices. i.e Wall sockets with multiple outlets */

{
  payload:{
    node: 2,
    class: "BinarySwitch",
    operation:"Set",
    endpoint:1, // zero based index. 0 - First outlet, 1 - second outlet and so on.
    params: [true]
  }
}
```

```
/* Issue a notification report */

let Report = {
  notificationType: 0x06,
  notificationEvent: 0x16
}

{
  payload:{
    node: 2,
    class: "Notification",
    operation:"SendReport",
    params: [Report]
  }
}
```

## Notes on WakeInterval  
When setting the interval, the **Controller Node ID** parameter will almost certainly be 1 - unless you have multiple controllers,
and you want the wake up to be recieved by a different controller. 

## Notes on GetSupportedKeys
This will return an array of ASCII codes - representing the keys that are supported on the device  

## Notes on ThermostatSetback  
If specifing a string, the valid values are: **Frost Protection** | **Energy Saving** | **Unused**

## Object Structures  

**MeterOptions**
```
{
  scale: Number,
  rateType: "Unspecified" | "Consumed" | "Produced"
}
```

**MeterResetOptions**
```
{
  type: number,
  targetValue: number
}
```

**Event**
```
{
  notificationType: Number,
  notificationEvent: Number,
  eventParameters: Buffer (Optional),
  sequenceNumber: Number (Optional)
}
```

**RemoveOptions**
```
{
  groupId: Number,
  nodeIds: Number[]
}
```

**Duration**
```
{
  Duration: {
    value: Number,
    unit: "seconds" | "minutes",
  }
}
```

**Color**
```
{
  hexColor: "#000000"
}
```

**Indicator**
```
{
  indicatorId: number;
  propertyId: number;
  value: number | boolean;
}
```