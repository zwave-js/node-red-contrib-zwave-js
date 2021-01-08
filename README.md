![Image](./ReadMe.png)  

# node-red-contrib-zwave-js
An extremely easy to use, zero dependency and feature rich ZWave node for node-red. Based on ZWave-JS

The implementation is 100% javascript. it is therefore:  
  - Very fast
  - Does not require a build of openzwave or any other library
  - Stable

Install this node via the Node-Red pallet menu, and you have zwave abilities.  
The node is straightforward to use, and removes all the complexities that you would otherwise need to deal with.

  - Add the node into your flow
  - Select the serial port that represents your USB Zwave radio.
  - Set an encryption key (if you want to use Secure devices)
  - Listen for, or send commands using the node.

  ![Image](./Demo.png)  

**node-red-contrib-zwave-js** is based on  [ZWave-JS](https://zwave-js.github.io/node-zwave-js/#/).  
ZWave-JS is actively  maintained, fast and supports the security command class.

## Example Usage (Managed Mode)
Send a command to a zwave device - encpsulate all your commands within a **payload** object.
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
    endPoint:1, // zero based index. 0 - First outlet, 1 - second outlet and so on.
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

Receiving commands is also trivial. Whenever your controller has been notified of an event, the node will inject the payload accodingly. 
The **object** will vary - it depends on the command class that was used in the transmission  
the payload below will also be emitted whenever you use any of the **Get** operations.
```
{
  payload: {
    node: 2,
    event: "VALUE_UPDATED",
    timestamp: "23-12-2020T12:23:23+000",
    object: ...
  }
}
```

## event Table.

| event                     | node                                | object                          | Meaning                       |
| ------------------------- | ----------------------------------- | ------------------------------- | ----------------------------- |  
| NODE_ADDED                | The ID of the added node            |                                 | A Node Was Added              |
| NODE_REMOVED              | The ID of the removed node          |                                 | A Node Was Removed            |
| INCLUSION_STARTED         |                                     | Bool : Only secure devices      | Include Mode Started          |
| INCLUSION_STOPPED         |                                     |                                 | include Mode Stopped          |
| EXCLUSION_STARTED         |                                     |                                 | Exclude Mode Started          |
| EXCLUSION_STOPPED         |                                     |                                 | Exclude Mode Stopped          |
| NETWORK_HEAL_DONE         |                                     |                                 | Done Healing Network          |
| NETWORK_HEAL_STARTED      |                                     |                                 | Started Healing Network       |
| NETWORK_HEAL_STOPPED      |                                     |                                 | Stopped Healing Network       |
| CONTROLLER_RESET_COMPLETE |                                     |                                 | The controller was reset      |
| VALUE_UPDATED             | The source Node ID                  | The objects command content     | A Value Was Updated           |
| NOTIFICATION              | The source Node ID                  | The objects command content     | A Notification Was Sent       |
| WAKE_UP                   | The source Node ID                  |                                 | A Node Has Woken Up           |
| SLEEP                     | The source Node ID                  |                                 | A Node Has Gone To Sleep      |
| INTERVIEW_COMPLETE        | The source Node ID                  |                                 | The node has been interviewed |
| INTERVIEW_FAILED          | The source Node ID                  | Detailed Error Info             | Could not interview node      |
| INTERVIEW_STARTED         | The source Node ID                  |                                 | Node interview started        |
| NODE_LIST                 |                                     | ZWaveNode[]                     | Response to GetNodes          | 



## Supported Class/Operation List  
Listed below are the outgoing, Managed CC's that are supported by this node.   
In reality, ZWave-JS supports a much larger range, and you should receive these regadless of the below list.  
i.e you can't interreact with them, but you will still receive the associated events.

The supported CC's within this node, will gradually increase, to mirror what ZWave-JS supports.

The **Controller** class does not require a **node** ID.  

| class                     | operation                           | params                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Controller                | StartHealNetwork                    |                                                       |
| Controller                | StopHealNetwork                     |                                                       |
| Controller                | StartInclusion                      | [Bool : Include Non-Secure]                           |
| Controller                | StopInclusion                       |                                                       |
| Controller                | StartExclusion                      |                                                       |
| Controller                | StopExclusion                       |                                                       |
| Controller                | HardReset (see Notes)               |                                                       |
| Controller                | ProprietaryFunc (See Notes)         | [Byte : Serial Function ID, Buffer : Data]            |
| Controller                | InterviewNode                       | [Number : Node ID]                                    |
| Controller                | GetNodes                            |                                                       |
| Association               | GetGroup                            | [Number : Group ID]                                   |
| Association               | AddNodes                            | [Number : Group ID, Number[] : NodeID's]              |
| Association               | RemoveNodes                         | [Number : Group ID, Number[] : NodeID's]              |
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
| DoorLock                  | Set                                 | [**DOOR LOCK MODE**]                                  |
| DoorLock                  | Get                                 |                                                       |
| Lock                      | Set                                 | [Bool]                                                |
| Lock                      | Get                                 |                                                       |
| MultiLevelSwitch          | Set                                 | [Number, **DURATION** (Optional)]                     |
| MultiLevelSwitch          | Get                                 |                                                       |
| Notification              | SendReport                          | [**EVENT**]                                           |
| ThermostatMode            | Set                                 | [**THERMOSTAT MODE**]                                 |
| ThermostatMode            | Get                                 |                                                       |
| ThermostatSetPoint        | Set                                 | [**SET POINT TYPE**, Number : Value, Number : Scale]  |
| ThermostatSetPoint        | Get                                 | [**SET POINT TYPE**]                                  | 
| WakeInterval              | Set (see Notes)                     | [Number : Seconds, Number : Controller Node ID]       |
| WakeInterval              | Get                                 |                                                       | 

## setValue, getValue & getDefinedValueIDs  (Unmanaged Mode)  

The combinations in the above table, use a managed approach, that is, the command classes are statically made available via the plugin.  
There is another way, that allows you to target command classes that are not natively supported by the plugin,  
but are supported by ZWave-JS.  

**setValue**, **getValue** and **getDefinedValueIDs**    

| class                     | operation                           | params                                                |
| ------------------------- | ----------------------------------- | ----------------------------------------------------- |
| Unmanaged                 | GetDefinedValueIDs                  | -                                                     | 
| Unmanaged                 | SetValue                            | [ValueID, Value]                                      |
| Unmanaged                 | GetValue                            | [ValueID]                                             |  

The difference with this approach, is that you supply a [ValueID](https://zwave-js.github.io/node-zwave-js/#/api/valueid)  
The ValueID interface uniquely identifies to which CC, endpoint and property a value belongs to.  

```
/* Get all ValueID's for a node */
{
  payload: {
    node: 2,
    class: "Unmanaged",
    operation: "GetDefinedValueIDs"
  }
}
```

```
/* Set a value */
/* NOTE : setValue only supports providing 2 params, the ValueID its self, and the value to set. */  
/* ValueID will be one of the ValueIDs returned from GetDefinedValueIDs */
{
  payload: {
    node: 2,
    class: "Unmanaged",
    operation: "SetValue",
    params: [ValueID,Value]
  }
}
```

```
/* Get a value */
/* ValueID will be one of the ValueIDs returned from GetDefinedValueIDs */
{
  payload: {
    node: 2,
    class: "Unmanaged",
    operation: "GetValue",
    params: [ValueID]
  }
}
```


## Notes on HardReset  
A one-way ticket for wiping out all the configuration on the controller.  
Once you call this method, there is no going back - you are hearby **WARNED of the consequences**.  

## Notes on ProprietaryFunc
The **Data** argument, must ONLY contain the data portion of the request  
As an example, this byte array **[0x01, 0x08, 0x00, 0xF2, 0x51, 0x01, 0x00, 0x05, 0x01, 0x51]**  
disables the LED on the GEN 5 Z-Stick, breaking it down we have:  

0x01 - SOF  
0x08 - Total Length  
0x00 - REQ  
0xF2 - Aeotec Set Configuration Function  
0x51 - LED Configuration  
0x01 - Configuration Value Size  
0x00 - Value  
0x05 - ??  
0x01 - ??  
0x51 - Serial API Checksum  

This means we do:

```
let _Buf_OFF = Buffer.from([0x51,0x01,0x00,0x05,0x01]) /*  LED Configuration
let _Buf_ON = Buffer.from([0x51,0x01,0x01,0x05,0x01])   *  Configuration Value Size
                                                        *  Value
                                                        *  ??
                                                        *  ??
                                                        */
{
  payload:{
    node: 2,
    class: "Controller",
    operation:"ProprietaryFunc",
    params: [0xF2, _Buf_OFF]
  }
}
```

**SOF**, **Total Length**, **REQ** & the **Serial API Checksum** will be provided for you.

## Notes on WakeInterval  
When setting the interval, the **Controller Node ID** parameter will almost certainly be 1 - unless you have multiple controllers,
and you want the wake up to be recieved by a different controller. 


## EVENT
The EVENT value should be an object formatted like below.  
```
{
  notificationType: Byte,
  notificationEvent: Byte,
  eventParameters: Buffer (Optional),
  sequenceNumber: Number (Optional)
}
```

## DURATION
The DURATION value should be an object formatted like below.  
```
{
  Duration: {
    value: Number,
    unit: "seconds" | "minutes",
  }
}
```

## DOOR LOCK MODE
| Values                      |  
| --------------------------- |
| Unsecured                   |
| UnsecuredWithTimeout        |
| InsideUnsecured             |
| InsideUnsecuredWithTimeout  |
| OutsideUnsecured            |
| OutsideUnsecuredWithTimeout |
| Unknown                     |
| Secured                     |


## SET POINT TYPE
| Values                |
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


## THERMOSTAT MODE
| Values                  |
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

## BINARY SENSOR TYPE
| Values             |
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

## Version History  

  - 1.1.2
    - Added Binary Sensor CC support  
    - Added Lock CC support  
	  - Added Support for **getDefinedValueIDs**, **setValue** and **getValue** methods
    - Restructured core code.

  - 1.1.1
    - Tidy up read me  
    - Optimisations to red event management
    - Broader range of events to capture value updates implemented.

  - 1.1.0 **Possible Breaking Change**  
    - Added Door Lock CC  
    - Added Association CC
    - Added Group Info CC
    - Fixed potential exception with operations that require a string value,
      They are now converted to their respective ZWave-JS numericle counterparts
    - Fixed Required, Optional parameter checking routine.
    - Duration object structure has been updated to correct a potential exception  
      Initially, the Duration object did not call the ZWave-JS Duration constructor - this has now been fixed.
    - Improvements to notification objects. **eventParameters** and **sequenceNumber** can now be provided


  - 1.0.5
    - Fixed mis-configured timeout defaults  
      If you're affected by this bug, remove, then re-add the node after the update.

  - 1.0.4
    - Ability to re-interview the nodes about their offerings.  
    - Added INTERVIEW_STARTED, INTERVIEW_COMPLETE and INTERVIEW_FAILED events.  
    - Added exception handling for invalid node ID's.  
    - Added a GetNodes function to the Controller class.  
    - Minor bug fixes.  

  - 1.0.3
    - Controller HardReset method added.  
    - Code formatting improved.
    - Read Me improvments  

  - 1.0.2
    - Potential erros during initialising are now handled.  
    - Added the ability to supply an **endPoint** parameter within the payload to target a specific channel (i.e multiple sockets for an outlet)  
    - Optimisations to driver configurarion.

  - 1.0.1
    - Fixed typo in package.json.

  - 1.0.0
    - Initial Release







