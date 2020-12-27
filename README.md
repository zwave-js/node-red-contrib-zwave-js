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

**node-red-contrib-zwave-js** is based on  [ZWave-JS](https://zwave-js.github.io/node-zwave-js/#/).  
ZWave-JS is actively  maintained, fast and supports the security command class.

## Example Time
Send a command to a zwave device - encpsulate all your commands within a **payload** object.
```
/* Set a configuration */
{
  payload:{
    node: 2,
    class: "Configuration",
    operation:"Set"
    params: [0x18, 0x03, 1] // Config Param, Config Value, Value Size
  }
}
```

```
/* Get a configuration */
/* The node will respond by injecting the result into your flow */
{
  payload:{
    node: 2,
    class: "Configuration",
    operation:"Get"
    params: [0x18] // Config Param
  }
}
```

```
/* Issue a notification report */
let Report = {
  notificationType: 0x06,
  notificationEvent: 0x16
}

let MessageToNode = {
  payload:{
    node: 2,
    class: "Notification",
    operation:"SendReport",
    params: [Report]
  }
}
```

Receiving commands is also trivial. Whenever your controller has been notified of something. the node will inject the payload accodingly. 
the **object** property can be various values, Integers, Decimals, complex structures, ... - it depends on the command class that was used in the transmission  
the payload below will also be emitted whenever you use any of the **Get** operations.
```
{
  payload:{
    node: 2,
    object: ... ,
    timestamp: "23-12-2020T12:23:23+000"
  }
}
```

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
|                           | ProprietaryFunc                     | [BYTE Serial Function ID, BYTE[] Data]            |
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
| WakeInterval              | Set                                 | [INTEGER Seconds, BYTE Controller Node ID]        |
|                           | Get                                 | -                                                 | 

## Notes on ProprietaryFunc
The **Data** argument, must ONLY contain the data portion of the request  
As an example, this byte array **[0x01, 0x08, 0x00, 0xF2, 0x51, 0x01, 0x00, 0x05, 0x01, 0x51]**  
disables the LED on the GEN 5 Z-Stick  breaking it down we have:  

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

