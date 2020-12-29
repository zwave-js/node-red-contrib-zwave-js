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

## Example Usage
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

| event                     | node                                | object                          | Meaning                     |
| ------------------------- | ----------------------------------- | ------------------------------- | --------------------------  |  
| NODE_ADDED                | The ID of the added node            | -                               | A Node Was Added            |
| NODE_REMOVED              | The ID of the removed node          | -                               | A Node Was Removed          |
| INCLUSION_STARTED         | -                                   | BOOL Only secure devices        | Include Mode Started        |
| INCLUSION_STOPPED         | -                                   | -                               | include Mode Stopped        |
| EXCLUSION_STARTED         | -                                   | -                               | Exclude Mode Started        |
| EXCLUSION_STOPPED         | -                                   | -                               | Exclude Mode Stopped        |
| NETWORK_HEAL_DONE         | -                                   | -                               | Done Healing Network        |
| NETWORK_HEAL_STARTED      | -                                   | -                               | Started Healing Network     |
| NETWORK_HEAL_STOPPED      | -                                   | -                               | Stopped Healing Network     |
| CONTROLLER_RESET_COMPLETE | -                                   | -                               | The controller was reset    |
| VALUE_UPDATED             | The source Node ID                  | The objects command content     | A Value Was Updated         |
| NOTIFICATION              | The source Node ID                  | The objects command content     | A Notification Was Sent     |
| WAKE_UP                   | The source Node ID                  | -                               | A Node Has Woken Up         |
| SLEEP                     | The source Node ID                  | -                               | A Node Has Gone To Sleep    |



## Supported Class/Operation List  

The **Controller** class does not require a **node** ID.  

| class                     | operation                           | params                                            |
| ------------------------- | ----------------------------------- | ------------------------------------------------- |
| Controller                | StartHealNetwork                    | -                                                 |
|                           | StopHealNetwork                     | -                                                 |
|                           | StartInclusion                      | [BOOL Include Non-Secure]                         |
|                           | StopInclusion                       | -                                                 |
|                           | StartExclusion                      | -                                                 |
|                           | StopExclusion                       | -                                                 |
|                           | HardReset (see Notes)               | -                                                 |
|                           | ProprietaryFunc (See Notes)         | [BYTE Serial Function ID, BYTE[] Data]            |
| Basic                     | Set                                 | [INTEGER]                                         |
|                           | Get                                 | -                                                 |
| Battery                   | Get                                 | -                                                 |
| BinarySwitch              | Set                                 | [BOOL, DURATION (Optional)]                       |
|                           | Get                                 | -                                                 |
| Configuration             | Set                                 | [BYTE ParamID, BYTE Value, INTEGER Value Length]  |
|                           | Get                                 | [BYTE ParamID]                                    |
| MultiLevelSwitch          | Set                                 | [INTEGER, DURATION (Optional)]                    |
|                           | Get                                 | -                                                 |
| Notification              | SendReport                          | [EVENT]                                           |
| ThermostatMode            | Set                                 | [THERMOSTAT MODE]                                 |
|                           | Get                                 | -                                                 |
| ThermostatSetPoint        | Set                                 | [SET POINT TYPE, INTEGER Value, INTEGER Scale]    |
|                           | Get                                 | [SET POINT TYPE]                                  | 
| WakeInterval              | Set (see Notes)                     | [INTEGER Seconds, BYTE Controller Node ID]        |
|                           | Get                                 | -                                                 | 

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

This mean we pass **[0xF2,[0x51,0x01,0x00,0x51,0x01]]** as the **params** argument to turn of the LED  
And for good measure, to turn it on  **[0xF2,[0x51,0x01,0x01,0x51,0x01]]**  

**SOF**, **Total Length**, **REQ** & the **Serial API Checksum** will be provided for you.

## Notes on WakeInterval  
When setting the interval, the **Controller Node ID** parameter will almost certainly be 0x01 (1) - unless you have multiple controllers,
and you want the wake up to be recieved by a different controller. 


## EVENT
The EVENT value should be an object formatted like below.  
```
{
  notificationType: 0x06,
  notificationEvent: 0x16
}
```

## DURATION
The DURATION value should be an object formatted like below.  
```
{
  unit: "seconds" | "minutes",
  value: 60
}
```

## SET POINT TYPE

| Set Point Type        |
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

| Thermostate Mode      |
| --------------------- |
| Off                   |
| Heat                  |
| Cool                  |
| Auto                  |
| Auxiliary             |
| Fan                   |
| Furnace               |
| Dry                   |
| Moist                 |
| Auto changeover       |
| Energy heat           |
| Energy cool           |
| Away                  |
| Full power            |
| Manufacturer specific |

## Version History  

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







