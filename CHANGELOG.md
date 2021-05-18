  # node-red-contrib-zwave-js Change Log

  - 3.5.0  **Possible Breaking Change**
    - Added support for **User Code** CC to Managed mode  
    - Added support for **Alarm Sensor** CC to Managed mode  
    - Added support for **Barrier Operator** CC to Managed mode  
    - Fixed Meter Optional param  
    - Removed a temporary work around captruing the mismatched  **endPoint** property  
      **endpoint** is now the required property (no longer a capital P) if specifying the endpoint.  
      See change log for 1.3.0.
    - Optimisations to **Duration** porcessing
    - Bump Z-Wave JS to 7.5.0
  
  - 3.4.0 **Deprecation Warnings**
    - Added a **PollValue** method to the Unmanaged class
    - Added a **GetValueDB** method to the Driver class
    - Added a **GetNodeNeighbors** method to the Controller class
    - The **neighbors** property for each node in **NODE_LIST** is now set for removal. (4.0.0)
    - Added Ability to adjust how frequently the values and metadata should be written to disk.
    - Added Ability to set a custom location for device config files
    - Node property sections no longer auto expanded in the UI (this can be changed)
    - Bump Z-Wave JS

  - 3.3.1
    - Added an optional **forceUpdate** object for **Managed** mode usage. [#51](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/51)  
    - Added the realtime status of the controller to the Node status text. [#47](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/47)  
    - Z-Wave Node Name and Location are now stored on the target device (if supported)
    - Improved Controller status events to further describe the order
    - Updated the descriptions between Managed and Unmanaged Modes

  - 3.3.0 **Deprecation Warnings**
    - Bump Z-Wave JS
    - Added new Association management methods via a new **Associations** class
    - The Managed **Association** and **AssociationGroupInfo** classes are now marked for removal (4.0.0).
    - Improvments/fixes to logger
    - Fixed Some UI weirdness
    - Improvments/fixes to Z-Wave Device Node

  - 3.2.4  
    - Fixed issue where ```null``` was being compared to ```undefined```

  - 3.2.3
    - Added **nodeName** and **nodeLocation** to incoming z-wave events, if they are set.  ([#44](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/44))  
    - Added ability to set Node Location in the UI.  
    - Bump Z-Wave JS
    - Fixed read me compatibility with **flows.nodered.org**

  - 3.2.2
    - Bump Z-Wave JS

  - 3.2.1
    - Added Home Assistant Guide 
    - Example syntax highlighting

  - 3.2.0
    - Bump Z-Wave JS (7.1.1).  
    - Overhauled Enum value validation (they are now imported, no longer mirrored)  
    - Enum values are removed from read me - you can now obtain them using class: **Driver**, operation: **GetEnums**  
    - Added support for **Sound Switch** CC to Managed mode.  
    - Added support for **Multi Level Sensor** CC to Managed mode.
    - Fixed **ThermostatSetback** enum validation  
    - Node Red module logging, is now embedded within the Z-Wave JS Logs.  
    - Added Z-Wave JS statistics reporting (optional).

  - 3.1.3
    - Bump Z-wave JS.  
    - Small updates to read me.

  - 3.1.2
    - Fixed missing ```node``` property in messages, when **ZWave Device** nodes are in use.

  - 3.1.1
    - Introduced a new node type of **ZWave Device**  
      This node works in conjunction with the main **Z-Wave JS Controller** node, allowing for much greater flexibility within your flows.  
      The node acts as a single ZWave device, allowing it to be placed in different flows.
    - Bug fixes.
    - code improvements  

  - 3.0.0 **Possible Breaking Changes**
    - Bug Fixes to Management UI
    - The Controller Node, is now hidden from the list of nodes.
    - Migrated to Z-Wave JS V7
    - Logging options added to config UI
    - Some 1.4.0 optimsiations removed, as recent changes to Z-Wave JS has made them unnecessary
    - Changes to the **NOTIFICATION** event.
        The **object** component will now contain the following structure
        ```javascript
        {
          ccId: Number, // Command Class ID 
          args: {} // The main event data (simple or complex, highly dependant on the CC)
        }  
        ```  
    - Controller operation **GetNodes** no longer returns an empty entry.
    - Fixed newly added nodes, not being marked as ready (and therefore not passing events)  
    - Per node information when calling **GetNodes** has been substantially increased.
    - Node status is now a string 'Unknown', 'Asleep', 'Awake', 'Dead', 'Alive'
    - Added a Controller function **SetNodeLocation**  
    - Added support for **Entry Control** CC to Managed mode.  
    - Fix Node-Red crash when using **SetValue** and where a timeout occurs on a node ([#29](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/29))


  - 2.0.0
    - Added a User Interface tab, allowing control/maintenance of the zwave network. ([#22](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/22))
    - Added an Unmanaged operation **GetValueMetadata**
    - Added a Controller function **SetNodeName**
    - Bump Z-Wave JS,
    - Bump serialports
    - Driver timeouts now use defaults if not provided.
    - Version information is now displayed in config UI.
    - Added support for **Indicator** CC to Managed mode.
    - Added support for **Meter** CC to Managed mode.  
    - Optimisations to param conversations, when params are in the form of a class on the Z-Wave JS side  
    - Secure include is now by default.

  - 1.4.0  **Possible Breaking Change**  
    - Bump Z-Wave JS to 6.4.0
    - The response to the Unmanaged method **GetValue** is now delivered via a **GET_VALUE_RESPONSE** event, where the **object** property contains the return value, and the Value ID
    - Fix Node Red crash on failure listing serial ports ([#18](https://github.com/zwave-js/node-red-contrib-zwave-js/pull/18))  
    - Optimisations to speed up initialisation of already inetrviewed nodes ([#20](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/20))  
    - Added **Thermostat Operating State** CC to Managed mode.  
    - Added **Thermostat Setback** CC to Managed mode.  
    - Added **Color Switch**  CC to Managed mode.  

  - 1.3.1
    - Z-Wave JS **value notification** event, is now delivered exclusively due to a difference in its payload from normal value updates. ([#12](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/12))

  - 1.3.0
    - Custom serial ports can now be provided. ([#7](https://github.com/zwave-js/node-red-contrib-zwave-js/pull/7))  
    - Bumped Z-Wave JS to 6.1.0  
    - Bumped Serial Ports to 9.0.6 
    - Fixed incorrect method signature for **RemoveNodes**  
    - Renamed **endPoint** to be more consistent with Z-Wave JS ([#10](https://github.com/zwave-js/node-red-contrib-zwave-js/pull/10))  
    - Defaulted **Params** to an empty array if not provided ([#10](https://github.com/zwave-js/node-red-contrib-zwave-js/pull/10))

  - 1.2.0
    - Added Binary Sensor CC support  
    - Added Lock CC support
    - Added Support for **getDefinedValueIDs**, **setValue** and **getValue** methods
    - Restructured core code.  
    - Encryption key can now be a hex array ([#5](https://github.com/zwave-js/node-red-contrib-zwave-js/issues/5)).

  - 1.1.1
    - Tidy up read me  
    - Optimisations to red event management
    - Broader range of events to capture value updates implemented.

  - 1.1.0 **Possible Breaking Change**  
    - Added **Door Lock**  CC to Managed mode.  
    - Added **Association**  CC to Managed mode.  
    - Added **Group Info**  CC to Managed mode.  
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
