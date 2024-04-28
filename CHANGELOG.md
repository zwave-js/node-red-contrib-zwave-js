  # node-red-contrib-zwave-js Change Log

  - 9.0.4

    **Maintenance Release**
      - Update dependencies


  - 9.0.3

    **Maintenance Release**
      - Update dependencies
      - Update Node/UI status with regards to Route Rebuilding

  - 9.0.2

    **Bug Fixes**
      - Fix `CMD Factory` crashing Node RED, when required values are missing.

  - 9.0.1

    **Bug Fixes**
      - Correctly attach to the network healing events.  
        V12 of the Driver renamed these events (to accurately describe what they actually do)  
        Seems I didn't update the event handlers  
        (please note: ~~healing~~ route rebuilding was still occurring, just the events were not being triggered)  
        Therefore Node RED was not aware of it's progress

      - Check for `NodeId` in notification events for device nodes (I missed 1)  
        This would have only affected notifications for `endpoints` > 0

  - 9.0.0

    **Breaking Changes**
      - The min node version is now 18
      - If you execute certain methods your self, the following have been renamed
        - `beginHealingNetwork` -> `beginRebuildingRoutes`
        - `stopHealingNetwork` -> `stopRebuildingRoutes`
        - `healNode` -> `rebuildNodeRoutes`

    **New Features**
      - Added `getValueTimestamp` to the `Value API` - args will be the single Value ID  
        The event will be `VALUE_TIMESTAMP`

    **Changes**  
      - Bump ZWave JS to v12
      - The `lastSeen` property will now use the Drivers internal value, which is persistant between reboots 

    **Deprecations**
      - The old message format has now been deprecated, and support will be removed in V10.
        [PLEASE SEE MIGRATION GUIDE](/APIChange-v9.md)
      - Support for `responseThroughEvent` will be removed in V10 (all methods will return in v10)
      - Support for `forceUpdate` will be removed in V10 (you will be requied to manage this your self if using the CC API)
      - Support for `getLastEvents` will be removed in V10 (the introdcution of the persistant `lastSeen` value and `getValueTimestamp` has made this somewhat bloatware)

  - 8.2.1

    **Changes**  
      - Bump ZWave JS

    **Bug Fixes**
      - Address Node RED 3.1 **evaluateJSONataExpression** Warning 


  - 8.2.0

    **Changes**  
      - Update dependencies. 

  - 8.1.0

    **Changes**  
      - Update dependencies. 
      - Switch serial port list to use Driver provided methods, removing the dependency on the serilaport package


  - 8.0.0

    **Breaking Changes**
      - Dropped support for Node 12 (min required is now 14.13.0)
      - If you use the **set** method of the **Configuration** CC in **CCAPI** mode, the arguments must now have one object (detailed below)
        ```javascript
        [
          {"parameter": <number>, "value": <Desired Value>, "valueSize": <Number>}
        ]
        ```
        previously this was ```[<number>, <Desired Value>, <Number>]```
      - **ValueAPI** is now default on the CMD Factory node.
        If you have problems with this node after the update, please open it up, and select your API, then save.

    **New Features**
      - Default scales can now be applied inside the controller config
      - Added ability to export/import node name & location maps
      - Implemented a Firmware Update Service, that allows to install Firmware on devices that have known updates - Please double click controller!
      - 2 new event types have been added : **ALIVE**, **DEAD** - these allow you to monitor if a device has been marked dead
        or alive accordingly.
      - Added a color chooser for color input types in the UI
      - Added a new **Driver** function **getLastEvents**  
      - Device last seen timestamp is now shown in the UI
      - Node list now contains the date when the device was last seen.

    **Bug Fixes**
      - Modal alerts are now rendering HTML content once again
      - Missing `normalizedObject.label` for Thermostat devices
      - Fix some data type odities in the UI editor
      - `msg` properties are now carried through the CMD Factory node

    **Changes**  
      - Current Value(s) who's type is an object have been changed to prompt for a double click in the UI
      - Association Management has been updated, and changes are now applied in batch.
      - For battery operated devices, certain UI actions now ask you to wake up said device before anything is comitted.
      - Various performance boosts in the UI
      - Bump ZWave JS to V10
      - Bump Winston
      - Bump ESlint

  - 7.1.2

    **Changes**  
      - Address minor security warnings
      - Bump ZWave JS
      - Bump Prettier

  - 7.1.1

    **Fixes**  
      - Missing body-parser module (we no longer use it) and now read the body directly from express.

    **Changes**  
      - Small improvements to power level sliders in RF settings, and the UI in general.
      - Updated all config inputs to use all available width.
      - The active Network ID is now part of the controller dialogs. 

  - 7.1.0

    **New Features**
      - Added new **Advanced Transceiver Settings** dialog (and where supported by the ZWave radio in use)
        - Region settings
        - RF Power settings
        - Backup/Restore NVM
      - The Inclusion completed dialog, now displays the security class that was achieved.

    **Changes**
      - Increase UI timeout to 15s to account for slower responding systems
      - Optimizations to firmware upload Mechanics.
      - Bump ZWave JS to 9.3.0.


  - 7.0.3

    **Changes**
      - Replaced LGTM quality check with deepscan  
      - Address deepscan alerts  
      - Added CodeQL security checks  
      - Bump Zwave JS to 9.2.2  
      - Implement publish to NPM workflow (github release)  
      - Update shields  

  - 7.0.2

    **Fixes**
     - Fix **networkId** format
     - Address LGTM alert

  - 7.0.1

    **Changes**
     - Small optimisations to Express route cleanup.


  - 7.0.0

    **Breaking Changes**
     - The **GET_VALUE_RESPONSE** object is no longer partitioned with **response** and **valueId** properties.
       Instead, the returned object now represents a shape simular to **VALUE_UPDATED** events.
       The value will now be attached to the **currentValue** property, along with the Value ID on the same level.
     - The **VALUE_DB** objects are no longer partitioned with **currentValue** and **valueId** properties.
       Instead, the returned objects now include the Value ID on the same level as **currentValue**
     - Much like above, **GET_VALUE_METADATA_RESPONSE** has also been simplified, where the result is attached to **metadata**, with the Value ID on the same level.

    **New Features**
     - **VALUE_UPDATED**, **VALUE_NOTIFICATION**, **GET_VALUE_RESPONSE** and **VALUE_DB** now contain a **normalizedObject** property.
       This property aims to make it easy to utilise the value change, in that it summarises the event with easy to understand property names.
     - An entierly new side panel UI. This redesign aims to better align with the Node RED style guide.
     - An entierly new Network Mesh Map, that is now based on routing header information instead of Node Neighbours.
     - Network statistics now include route information that is obtained during communication, and is used
       as the basis of the new map.
     - Multiple ZWave sticks/Networks are now supported (finally)
       - All message will contain a property of **networkId** to indentify the source network.  
         **WARNING**: Before adding another network - please ensure you open up the currently configured Controller  
               and save it again (Remembering to deploy) - this will allign the current network to ID 1
     - Improved Recovery when the USB/ZWave transceiver has been removed/re-introduced.
       - This is possible with a custom Watchdog implmentation, this introduces a new event type of **WATCHDOG**
         Which will describe what is happening. 

    **Fixes**
     - Nodes that are not marked as ready can now be removed correctly.
     - Fix potential issue when **httpAdminRoot** has a custom value.
     - Various performance, stability and optimisations to the UI.
     - UI Interaction is no longer picked up by Device Nodes.

    **Changes**
     - Bump serialport to V10
     - Bump ZWJS to V9
     - New mapping algorithm - The new algorithm results in a much needed accuracy improvement, and is far superior to previous methods.
     - Nodes have now been named more clearly
     - Live Camera QR Code Scanning has been removed



  - 6.5.5
  
    **Fixes**
     - Fix NPM Ignore rules

  - 6.5.4

    **Changes**
     - Smart Start Web Application, has been moved to use the express instance provided by Node RED
       - Live QR Scanning now requires Node RED to be SSL Enabled - basic QR capture can still be used without SSL.
     - Added Min Node RED Version to package.json
     - Switched static resources to use /resources/ endpoint provided by Node RED
     - Added node examples
     - Bump Zwave JS to 8.11.3  
     - Bump ESLint to 8.8.0

  - 6.5.3

    **Fixes**
     - Wait for driver unload.

  - 6.5.2

    **Fixes**
     - Don't soley depend on the **node removed** event to progress the exclusion Wizard
     - Check if a node is selected before opening up a dialog

    **New Features**
     - Expose the Driver option to disable Optimistic Value Updates
     - Added the ability to hide the status label for device and event filter nodes

    **Changes**
     - Renamed the **Abort** button during S2 inclusion to better identify its intention
     - Bump ZWJS to 8.11.2  
     - Bump Winston to 3.5.0

  - 6.5.1

    **Fixes**
     - Battery icon/popup text in the UI is now (finally) kept in sync
     - Driver readiness for Health Checks and Keep Alive requests in the UI

    **Changes**
     - Improvements to node readiness in the UI
     - Bump ZWJS to 8.11.0  


  - 6.5.0

    **New Features**
     - Added the ability to keep a node awake via the UI
     - Added a new method in the UI to report the health of a nodes conection to the controller
     - Added native camera/image capture controls for Smart Start QR Scanning on the mobile client
    
    **Changes**
     - Replace **EventEmitter** with an internal instance - to address a **MaxListenersExceeded** warning.
     - Statistics are now taken directly from the node/controller (previously taken from captured event data)
     - Small improvements to UI server component structure.
     - Bump ZWJS to 8.10.2  
     - Bump Winston to 3.4.0  
     - Bump Winston-Transports to 4.4.2  
     - Bump ESLint to 8.6.0  
 
  - 6.4.1

    **Changes**
     - Bump ZWJS to 8.9.2  
     - Bump Express to 4.17.2  
     - Bump Winston-Transports to 4.4.1  
     - Bump ESLint to 8.5.0  


  - 6.4.0

    **Fixes**
     - When a new node appears in the UI list, after it gets added to the network, its battery is correctly reported.
     - Fix potential crash, if **Remove Failed Node** is called twice for the same node.
     - Device nodes now clone the received network message, removing a situation where filter node outputs,
       are affected by other device nodes having the same interest in the object.
     - Account for 3 digit node ID's in UI
     - Fixed `event-filter` ignoring `strict `mode

    **New Features**
     - Implemented Zwave S2 Security Smart Start.  
       This includes a new mobile UI, allowing you to use it as a device inclusion tool.
     - Expose further driver timeout options
    
    **Changes**
     - Controller ready checks are now made prior to showing any UI modal form, that may depend on the controller.  
     - The battery icon in the node list is now updated, whenever a device transmits an update.  
     - JSON Keys are now quoted in the UI monitor.  
     - The **timestamp** value in event messages are now the time in milliseconds from the unix epoch.  
     - Bump ZWJS to 8.8.2
     - Bump serial port to 9.2.8

  - 6.3.0

    **Fixes**
     - Fixed duplicated event handlers, after a new interview.

    **New Features**
     - Lock User Codes can now be optionally interviewed.  
       Note: This will cause an increase in traffic - especially if your lock has many codes to query.
     - Opt-in to Soft Reset USB device.  
       This is needed for certain commands, like changing the RF.
     - A new "UI Monitor", allowing you to capture/use the commands that are sent to the controller

    **Changes**
     - Changes to package content to reduce size (~9.0MB -> ~1.3MB)
     - The node list is now sorted by Node ID
     - Bump ZWJS to 8.5.1

  - 6.2.0 
  
    **New Features**
     - Added a new **cmd-factory** node, that allows to construct commands with little to no knowledge in the required format
     - Added power source icon and battery level in the UI node list
     - Added **powerSource** property to the **NODE_LIST** response.
     - Device-Nodes now have the ability to receive isolated responses to **getValue**

    **Changes**
     - Bump serialport package.
     - Bump zwave-js.
     - The node status on the UI, has been updated to make use of icons, as opposed to text
     - A Complete overhaul on Help/guide material for each node
     - **Data Mode** has been renamed to **Network Mode** on the device node

    **Internal Changes**
     - Improvements to driver event sanitization routines
     - Security enhancements to the HTTP API
     - Moved all HTTP API endpoints to the ui/server.js module
     - The **serialport** package is no longer forcibly compiled, and is now left for serialport to decide  
       if compilation is necessary.

    **Fixes**
     - Fixed a potential issuse, if the node-red admin ui path is set to a custom value.


  - 6.1.1 
  
    **Fixes**
     - Fixed multi-channel associations uisng the HTML element its self as opposed to its value.

    **Changes**
     - Bump ZWave-JS to 8.4.1

  - 6.1.0

    **Changes**
     - The device node set to **Multiple Nodes**, now supports omitting the **node** in your payload.
       The submitted payload will be distrbuted to each node, but will do so with rate limiting, which can be changed.

       Including a **node** in your payload, will target that node only - providing it is selected.

  - 6.0.0

    **Breaking Changes**
     - The network keys MUST now be a hex string.
        - If you currently use a 16 character string, use a string to hex  converter (http://string-functions.com/string-hex.aspx)
        - If using a byte array, simply copy the array and patse it back in,
          it will convert the byte array to its hex string equivalent.

        If you do not use security, this breaking change does not apply.

     - The following events have been named correctly according to the driver.
        - NETWORK_HEAL_DONE -> HEAL_NETWORK_DONE
        - FIRMWARE_UPDATE_COMPLETE -> FIRMWARE_UPDATE_FINISHED
        - INTERVIEW_COMPLETE -> INTERVIEW_COMPLETED

    **New Features**
     - Implement official device db update mechanism.
     - Network keys can now be generated
     - S2 Supervision Get has now been implemented (Driver)

    **Fixes**
     - Correctly report the Config DB version as used by the driver.
     - Interview Failed event, is now only triggered on the last retry.
     - S2 Endpoint interview now correctly completes (Driver)

    **Changes**
     - Default log file name is now zwave-js.log
     - Bump ZWave JS to 8.3.1

  - 5.1.2

    **Changes**
     - Read me typo

  - 5.1.1  

    **Changes**
     - Display Driver DB Version in node config
     - Bump serial ports to 9.2.1 
     - Fix LGTM Alerts

  - 5.1.0  
  
     **New Features**
     - Added an extremely advanced **event-filter** node, allowing node events to be filtered with ease.
     - Added the ability to pipe log messages to a 2nd output pin of the Controller Node
     - Added a new event type: **ALL_NODES_READY** 

     **Fixes**
     - Fix phantom parentheses in node location.

     **Changes**
     - Improvements to the device paring wizard.
     - Bump Zwave JS to 8.2.3

   - 5.0.0

     **Breaking Changes**
     - Legacy API has now been removed (deprecated  in V4 [PLEASE SEE MIGRATION GUIDE](/APIChange.md))
     - Min Node version is now **12.22.2**
     - Node Inclusion, Exclusion and Replace methods are no longer possible using messages,  
       these must now be performed using the UI
     - The ```node``` property is now omitted for none node events.

     **Changes**
     - Migrate to Z-Wave JS Version 8
     - Device Node status text is now reduced down to a more acceptable length
     - Code refactoring
     - Various bug fixes/improvements
     - Migrated Read Me to github Wiki
     - Improvements to ready status checks
     - Sanity checks to ensure  S0 and S2 encryption keys are present

     **New Features**
     - Added ZWave Security S2 support
     - Multicast is now suppoorted on CCAPI (set type commands Only)
     - The text box inputs on the UI are now committed on the enter/return key.
     - Added Individual Node Heal. 

  - 4.3.0
    - Implemented critical driver error recovery.  

      This update implements a maximum retry routine (max 3), for critical driver errors.  
      Initially, critical errors were not recoverable, and needed a restart of the module.  
      We now try a maximum of 3 times, before giving up.
      
  - 4.2.1
    - Fix Node Red V2 UI compatibility on the zwave Z-Wave tab. 

  - 4.2.0
    - Device Nodes can now be setup to only Send or Receive messages (or both), for better organisation.
    - Device Nodes in a subflow, now offers the use of a Variable to specify a single node 
    - Node Lists in UI/Config, are now grouped by Location
    - Corrected error in Readme example code
    - Multicast bug fixes

  - 4.1.0
    - Bug fixes on **zwave-device** node 
    - **zwave-device** node now has the following modes
      - All Nodes
      - Multiple Nodes
      - Multicast
      - Specific Node
      - As Specified
    - Bug fixes on the main node 
    - UI now handles the driver not being ready, and now waits before listing nodes.
    - Bump Z-Wave JS to 7.12.1

  - 4.0.0 **Possible Breaking Changes**, **Deprecation Warnings**
    - MAJOR API Transition : [PLEASE SEE MIGRATION GUIDE](/APIChange-v4.md)
    - Added Node Firmware Update UI
    - Added Network Map UI
    - Added Association Group Managment UI
    - Selection of Home ID in the UI is no longer required.
    - Fixed UI bug that stopped manaual entry for params with predefined values
    - **neighbors** property has now been removed in **NODE_LIST** (see Change log 3.4.0)
    - **Association** class has now been removed (see Change log 3.3.0)
    - Value API Mode now supports a duration
    - Added 2 more **DriverAPI** methods to retrieve network performance stats: **getNodeStatistics**, and **getControllerStatistics**
    - Bump Z-Wave JS to 7.11.0
    - Bump serialport to 9.2.0


  - 3.8.0
    - Major User Interface Cleanup
      - Controller Node status text is now repeated on the UI
      - Firmware Version of the Controller and Devices is now displayed (replaces description)
      - Insecure Inclusion checkbox removed, and replaced with a prompt
      - The **More Info** button is now removed, as it never provided any useful info
      - Reset Controller can now be performed in the UI
      - Bug Fixes
      - Optimisations/Improvments to UI communication with the main module
    - Added a new **Controller** Method of **ReplaceFailedNode** (Also available in the UI)
    - Log Level in config is now sorted by severity
    - The **NETWORK_HEAL_DONE** event now contains an object detailing the Heal outcome.
    - Small Optimisations to **Z-Wave Device** node
    - Re-worked the Icons.
    - Bump Z-Wave JS to 7.7.5

  - 3.7.1
    - Fix typo in **SetRFRegion** code

  - 3.7.0
    - Added **ToggleRF** method to the **Controller** class
    - Added **SetRFRegion** and **GetRFRegion** methods to the **Controller** class
    - Bumped Z-Wave JS to 7.7.1
    - Bumped Serial Ports to 9.1.0

  - 3.6.0
    - Added ability to Keep Nodes Awake using a controller method of **KeepNodeAwake**
    - Added Keep Awake Status in **NODE_LIST**
    - Bumped Z-Wave JS to 7.6.0

  - 3.5.0  **Possible Breaking Change**
    - Added support for **User Code** CC to Managed mode  
    - Added support for **Alarm Sensor** CC to Managed mode  
    - Added support for **Barrier Operator** CC to Managed mode  
    - Added support for **Clock** CC to Managed mode  
    - Fixed Meter Optional param  
    - Removed a temporary work around capturing the mismatched  **endPoint** property  
      **endpoint** is now the required property (no longer a capital P) if specifying the endpoint.  
      See change log for **1.3.0**.
    - Optimisations to **Duration** porcessing
    - The **forceUpdate** object for Managed access, can now contain any property normally found in the ValueID interface.  
      Including overwriting the **endpoint** property - which will normally be provided for you.
    - Bump Z-Wave JS to 7.5.2  
    - Bump Serial Ports 
  
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
