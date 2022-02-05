![Image](./GHImages/ReadMe.png)  

# node-red-contrib-zwave-js

![NPM](https://img.shields.io/npm/l/node-red-contrib-zwave-js)
![npm](https://img.shields.io/npm/v/node-red-contrib-zwave-js)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/zwave-js/node-red-contrib-zwave-js.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/zwave-js/node-red-contrib-zwave-js/context:javascript)
![npms.io (maintenance)](https://img.shields.io/npms-io/maintenance-score/node-red-contrib-zwave-js)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/node-red-contrib-zwave-js)

The most powerful/fully integrated Z-Wave node for Node-RED based on Z-Wave JS. If you want a fully featured Z-Wave framework in your Node-RED instance, look no further.

> ### ...node-red-contrib-zwave-js is _hands down the best Z-Wave to Node-RED option on the planet._  
> [@CRXPorter](https://github.com/crxporter), July 2021.  

### What is it?

 - Part of the awesome [Z-Wave JS](https://github.com/zwave-js) org
 - 100% Javascript, so its blazing fast!
 - Does not require a build of any static library
 - Stable
 - The Ability to capture commands for later use.
 - A deep integrated UI within in node red
 - Full Z-Wave control inside Node-RED including:
   - Device inclusion/exclusion wizard
   - S0 and S2 security support
   - Supports Security S2 Smart Start (Mobile companion web application)  
   - Network health checks  
   - Network mesh graph
   - Firmware updates
   - Associations management
   - Filter node for handling incoming messages from your devices
   - Factory node for simplifying the formatting of outgoing messages
   - Multicast command support

Since `node-red-contrib-zwave-js` is based on [Z-Wave JS](https://zwave-js.github.io/node-zwave-js/#/), we have the support and active maintenance from the amazing group of developers who have built the libraries, APIs, and config files which run this contrib.

### The User Interface

![Image](./GHImages/ZWUI.gif) 

Included with the contrib is a [user interface](https://github.com/zwave-js/node-red-contrib-zwave-js/wiki/User-Interface) where Z-Wave network management is handled. The controller side of the UI is used to include/exclude devices, heal the network, update firmware, and view the network map for diagnosing problems. The device side of the UI is used to configure devices, manage associations, and provide setup help for the nodes which will be used in your flows.

### The Nodes

![Image](./GHImages/Demo.png)

There are 4 node types included with this contrib ([click here](https://github.com/zwave-js/node-red-contrib-zwave-js/wiki/node-types) for full details about these nodes)
 - `zwave-js`: this node is used to set up a connection to your USB Z-Wave controller, set security keys, and manage various advanced controller options
 - `zwave-device`: this node is used to send and receive messages to one or more of the Z-Wave devices on your network
 - `event-filter`: this node is used to filter and sort messages from your Z-Wave devices
 - `cmd-factory`: this node simplifies creation of messages being sent to your Z-Wave devices

### Getting Started Links
 - [Installing](https://github.com/zwave-js/node-red-contrib-zwave-js/wiki/getting-started): system requirements and install instructions
 - [Just Show Me How](https://github.com/zwave-js/node-red-contrib-zwave-js/wiki/First-Z-Wave-Flow-Setup): first day walkthrough
 - [Wiki](https://github.com/zwave-js/node-red-contrib-zwave-js/wiki/getting-started): just about everything
 - [Change Log](./CHANGELOG.md): whats changed?

### Awesome People - Thanks!

 - [marcus-j-davies](https://github.com/marcus-j-davies) our main developer who claims "*my software doesn't have bugs*"
 - [AlCalzone](https://github.com/AlCalzone) for creating [ZWave-JS](https://github.com/zwave-js/node-zwave-js) that makes this possible
 - [hufftheweevil](https://github.com/hufftheweevil) for creating the User Interface tab
 - [CRXPorter](https://github.com/crxporter) for creating all the help material/finding this project
 - [thk](https://github.com/thk-socal) for the relentless beta testing
