# Managed Usage.  
  
First, lets get out the way, what Managed mode is.  
Managed mode is where the node-red plugin it's self does a lot of the heavy lifting. Locating the correct command class, correct node, its endpoint, so on and so forth.

Managed mode, allows easy accesss, the downside with Managed mode, is that command class support needs to be 'Bridged',  
so that the command classes, can be used in an easy way.  

Currently, the supported command classes are (when using Managed mode).

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
| Configuration             | Set                                 | [Number : ParamID, Number : Value, Number : Value Length] |
| Configuration             | Get                                 | [Number : ParamID]                                    |
| ColorSwitch               | Set                                 | [**COLOR**]                                           |
| ColorSwitch               | Get                                 | [**COLOR COMPONENT**]                                 |
| DoorLock                  | Set                                 | [**DOOR LOCK MODE**]                                  |
| DoorLock                  | Get                                 |                                                       |
| EntryControl              | SetConfiguration                    | [Number : Key Cache Size, Number : Cache Timeout]     |
| EntryControl              | GetConfiguration                    |                                                       |
| EntryControl              | GetSupportedKeys (see notes)        |                                                       |
| Lock                      | Set                                 | [Bool]                                                |
| Lock                      | Get                                 |                                                       |
| Indicator                 | Set                                 | [Number : Value] OR [**INDICATOR**[]]                 |
| Indicator                 | Get                                 | [Number : Indicator (optional)]                       |
| Meter                     | Get                                 | [**METER OPTIONS**]                                   |
| Meter                     | GetAll                              |                                                       |
| Meter                     | Reset                               | [**METER RESET OPTIONS**]                             |
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
| WakeInterval              | Set (See Notes)                     | [Number : Seconds, Number : Controller Node ID]       |
| WakeInterval              | Get                                 |                                                       | 

The aim of course is to expose them all.

## Example 101
See below, for examples on how to interrogate the CC's in the table above.  
  
**NOTE:** You do not need to specify the ```node``` IF the message, is going through the **Filter Node**  
The filter node takes care to address the message to the correct zwave device.

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

## Enums and formatted values.
Some command classes, require a certain structure in there payload, so please refer to the below information.  
the CC's above should tell you what is required.



## Structures  

The **METER OPTIONS** value should be an object formatted like below.  
```
{
  scale: Number,
  rateType: "Unspecified" | "Consumed" | "Produced"
}
```

The **METER RESET OPTIONS** value should be an object formatted like below.  
```
{
  type: number,
  targetValue: number
}
```

The **EVENT** value should be an object formatted like below.  
```
{
  notificationType: Number,
  notificationEvent: Number,
  eventParameters: Buffer (Optional),
  sequenceNumber: Number (Optional)
}
```

The **REMOVE OPTIONS** value should be an object formatted like below.  
```
{
  groupId: Number,
  nodeIds: Number[]
}
```

The **DURATION** value should be an object formatted like below.  
```
{
  Duration: {
    value: Number,
    unit: "seconds" | "minutes",
  }
}
```

The **COLOR** value should be an object formatted like below.  
```
{
  hexColor: "#000000"
}
```

The **INDICATOR** value should be an object formatted like below.  
```
{
  indicatorId: number;
  propertyId: number;
  value: number | boolean;
}
```

## ENUMS 

| DOOR LOCK MODE              |  
| --------------------------- |
| Unsecured                   |
| UnsecuredWithTimeout        |
| InsideUnsecured             |
| InsideUnsecuredWithTimeout  |
| OutsideUnsecured            |
| OutsideUnsecuredWithTimeout |
| Unknown                     |
| Secured                     |

| SET POINT TYPE        |
| --------------------- |
| N/A                   |
| Heating               |
| Cooling               |
| Furnace               |
| Dry Air               |
| Moist Air             |
| Auto Changeover       |
| Energy Save Heating   |
| Energy Save Cooling   |
| Away Heating          |
| Away Cooling          |
| Full power            |

| THERMOSTAT MODE         |
| ----------------------- |
| Off                     |
| Heat                    |
| Cool                    |
| Auto                    |
| Auxiliary               |
| Fan                     |
| Furnace                 |
| Dry                     |
| Moist                   |
| Auto changeover         |
| Energy heat             |
| Energy cool             |
| Away                    |
| Full power              |
| Manufacturer specific   |

| BINARY SENSOR TYPE |
| ------------------ |
| General Purpose    |
| Smoke              |
| CO                 |
| CO2                |
| Heat               |
| Water              |
| Freeze             |
| Tamper             |
| Aux                |
| Door/Window        |
| Tilt               |
| Motion             |
| Glass Break        |
| Any                |

| SET BACK TYPE      |
| ------------------ |
| None               |
| Temporary          |
| Permanent          |

| SET BACK STATE     |
| ------------------ |
| Frost Protection   |
| Energy Saving      |
| Unused             |

| COLOR COMPONENT    |
| ------------------ |
| Warm White         |
| Cold White         |
| Red                |
| Green              |
| Blue               |
| Amber              |
| Cyan               |
| Purple             |
| Index              |