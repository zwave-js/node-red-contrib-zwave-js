# Managed Usage.  
  
First, lets get out the way, what Managed mode is.  
Managed mode is where the node-red plugin it's self does a lot of the heavy lifting. Locating the correct command class, correct node, its endpoint, so on and so forth.

Managed mode, allows easy accesss, the downside with Managed mode, is that command class support needs to be 'Bridged',  
so that the command classes, can be used in an easy way.  

Secondly, let's get out the way the currently supported command classes (when using Managed mode), the aim of course is to expose them all.

| class                     | operation                           | params                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Association               | GetGroup                            | [Number : Group ID]                                   |
| Association               | AddNodes                            | [Number : Group ID, Number[] : NodeID's]              |
| Association               | RemoveNodes                         | [**REMOVE OPTIONS**]                                  |
| Association               | RemoveNodesFromAllGroups            | [Number[] : NodeID's]                                 |
| Association               | GetGroupCount                       |                                                       |
| AssociationGroupInfo      | GetGroupName                        | [Number : Group ID]                                   |
| Basic                     | Set                                 | [Number]                                              |
| Basic                     | Get                                 |                                                       |
| Battery                   | Get                                 |                                                       |
| BinarySensor              | Get                                 | [**BINARY SENSOR TYPE**]                              |
| BinarySwitch              | Set                                 | [Bool, **DURATION** (Optional)]                       |
| BinarySwitch              | Get                                 |                                                       |
| Configuration             | Set                                 | [Byte : ParamID, Byte : Value, Number : Value Length] |
| Configuration             | Get                                 | [Byte : ParamID]                                      |
| ColorSwitch               | Set                                 | [**COLOR**]                                           |
| ColorSwitch               | Get                                 | [**COLOR COMPONENT**]                                 |
| DoorLock                  | Set                                 | [**DOOR LOCK MODE**]                                  |
| DoorLock                  | Get                                 |                                                       |
| Lock                      | Set                                 | [Bool]                                                |
| Lock                      | Get                                 |                                                       |
| Indicator                 | Set                                 | [Number : Value] OR [**INDICATOR**[]]                 |
| Indicator                 | Get                                 | [Number : Indicator (optional)]                       |
| MultiLevelSwitch          | Set                                 | [Number, **DURATION** (Optional)]                     |
| MultiLevelSwitch          | Get                                 |                                                       |
| Notification              | SendReport                          | [**EVENT**]                                           |
| ThermostatMode            | Set                                 | [**THERMOSTAT MODE**]                                 |
| ThermostatMode            | Get                                 |                                                       |
| ThermostatSetPoint        | Set                                 | [**SET POINT TYPE**, Number : Value, Number : Scale]  |
| ThermostatSetPoint        | Get                                 | [**SET POINT TYPE**]                                  | 
| ThermostatOperatingState  | Get                                 |                                                       | 
| ThermostatSetback         | Set                                 | [**SET BACK TYPE**, **SET BACK STATE**]               | 
| ThermostatSetback         | Get                                 |                                                       | 
| WakeInterval              | Set (see Notes)                     | [Number : Seconds, Number : Controller Node ID]       |
| WakeInterval              | Get                                 |                                                       | 

## Just show me how to get started.

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

