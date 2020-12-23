# node-red-contrib-zwave-js
An extremely easy to use, zero dependency and feature rich ZWave node for node-red. Based on ZWave-JS.

This implementation is 100% javascript. it is therefore:  
  - Very fast
  - Does not require a build of openzwave or any other library
  - Stable

Install this node via the Node-Red pallet menu, and you have zwave abilities.  
The node is streignt forward to use, and removes all the compleixity that you woul otherwise need to deal with.

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
    operation: "SetConfiguration",
    operation_vars: [0x18, 0x03, 1] // Config Param, Config Value, Value Size
  }
}
```

```
/* Get a configuration */
/* The node will respond by injecting the result into your flow */
{
  payload:{
    node: 2,
    operation: "GetConfiguration",
    operation_vars: [0x18] // Config Param
  }
}
```

```
/* Issue a notification report */
{
  payload:{
    node: 2,
    operation: "SendNotificationReport",
    operation_vars: [0x06,0x16] // Notification Type, Notification Event (i.e. sending  Access Control -> Window/Door Open, to a zwave siren)
  }
}
```

Receiving commands is also trivial. Whenever your controller has been notified of something. the node will inject the payload accodingly. 
the **object** property can be various values, Integers, Decimals, complex structures, ... - it depnds on the command class that was used in the transmission  
the payload below will also be emitted whenever you use any of the **Get\*** commands.
```
{
  payload:{
    node: 2,
    object: ... ,
    timestamp: "23-12-2020T12:23:23+000"
  }
}
```

## Supported Command List

| operation              | operation_vars                      |
| ---------------------- | ----------------------------------- |
| StartHealNetwork       | -                                   |
| StopHealNetwork        | -                                   |
| StartInclusion         | [Include Non-Secure]                |
| StopInclusion          | -                                   |
| StartExclusion         | -                                   |
| StopExclusion          | -                                   |
| ---------------------- | ----------------------------------- |
| GetBattery             | -                                   |
| GetConfiguration       | [Param ID]                          |
| SetConfiguration       | [Param ID, Value, Value Size]       |
| GetBasic               | -                                   |
| SetBasic               | [Value]                             |
| GetBinary              | -                                   |
| SetBinary              | [Value, Duration (optional)]        |
| GetWakeInterval        | -                                   |
| SetWakeInterval        | [Value]                             |
| GetMultiLevelSwitch    | -                                   |
| SetMultiLevelSwitch    | [Value, Duration (optional)]        |
| SendNotificationReport | [Type, Event]                       |
| SetThermostatMode      | [Thermostat Mode]                   |
| GetThermostatMode      | -                                   |
| SetThermostatSetPoint  | [Thermostat Mode, Value, Scale]     |
| GetThermostatSetPoint  | [Thermostat Mode]                   |

## Duration
The duration value should be an object formatted like below.  
```
{
  unit: "seconds" | "minutes",
  value: 60
}
```

## Thermostat Mode  

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
