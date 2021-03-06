let ZwaveJsUI = (function () {

  function modalAlert(message, title) {
    let Buts = {
      Ok: function () { }
    }
    modalPrompt(message, title, Buts);
  }

  function modalPrompt(message, title, buttons, addCancel) {

    let Options = {
      draggable: false,
      modal: true,
      resizable: false,
      width: 'auto',
      title: title,
      minHeight: 75,
      buttons: {}
    }

    Object.keys(buttons).forEach((BT) => {
      Options.buttons[BT] = function () {
        $(this).dialog('destroy');
        buttons[BT]();
      }
    })

    if (addCancel) {
      Options.buttons['Cancel'] = function () {
        $(this).dialog('destroy');
      }
    }

    $('<div>').css({ padding: 10, maxWidth: 500, wordWrap: 'break-word' }).html(message).dialog(Options)
  }

  var FirmwareForm;
  let FWRunning = false;
  function AbortUpdate() {
    if (FWRunning) {
      ControllerCMD('ControllerAPI', 'abortFirmwareUpdate',undefined, [selectedNode])
        .then(() => {
          FirmwareForm.dialog('destroy');
          let nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${selectedNode}']`)
          nodeRow.find('.zwave-js-node-row-status').html('UPDATE ABORTED')
        })
    }
    else {
      FirmwareForm.dialog('destroy');
    }
    FWRunning = false;
  }

  function PerformUpdate() {

    let FE = $("#FILE_FW")[0].files[0]
    let NID = parseInt($("#NODE_FW option:selected").val());
    let Target = $("#TARGET_FW").val();
    let Filename = FE.name;
    let Code = NID + ":" + Target + ":" + Filename

    var reader = new FileReader();
    reader.onload = function () {
      let arrayBuffer = this.result
      let array = new Uint8Array(arrayBuffer)
      let Options = {
        url: `zwave-js/firmwareupdate/` + btoa(Code),
        method: 'POST',
        contentType: 'application/octect-stream',
        data: array,
        processData: false
      }
      $.ajax(Options)
        .then(() => {
          FWRunning = true;
          selectNode(NID)
          $(":button:contains('Close')").prop("disabled", true).addClass("ui-state-disabled");
          $(":button:contains('Begin Update')").prop("disabled", true).addClass("ui-state-disabled");
          $("#FWForm").append('<div id="progressbar"><div></div></div>')
        })
        .catch((err) => {
          modalAlert(err.responseText, "Firmware Rejected")
        })
    }
    reader.readAsArrayBuffer(FE);
  }

  function FirmwareUpdate() {
    let Options = {
      draggable: false,
      modal: true,
      resizable: false,
      width: '800',
      height: '600',
      title: "ZWave Device Firmware Updater",
      minHeight: 75,
      buttons: {
        'Begin Update': PerformUpdate,
        Abort: AbortUpdate,
        Close: function () {
          $(this).dialog('destroy');
        }
      }
    }

    FirmwareForm = $('<div>').css({ padding: 10 }).html('Please wait...');
    FirmwareForm.dialog(Options)

    ControllerCMD('ControllerAPI', 'getNodes')

      .then(({ object }) => {

        FirmwareForm.html('');

        let Template = $('#TPL_Firmware').html();
        let templateScript = Handlebars.compile(Template);
        let HTML = templateScript({nodes:object});

        FirmwareForm.append(HTML)

      })
  }

  let Groups = {}

  function AddAssociation(){

    let NI = $('<input>').attr('type','number').attr('value',1).attr('min',1)
    let EI = $('<input>').attr('type','number').attr('value',0).attr('min',0)

    let Buttons = {
      Add: function () {
        let PL = [
          { nodeId: selectedNode, endpoint: parseInt($("#NODE_EP").val()) },
          parseInt($("#NODE_G").val()),
          [{ nodeId: parseInt(NI.val())}]
        ]

        if(parseInt(EI.val()) > 0){
          PL[2][0].endpoint = EI.val(parseInt(EI.val()))
        }

        ControllerCMD('AssociationsAPI', 'addAssociations', undefined, PL)
          .then(() => { GMGroupSelected() })
          .catch((err) => {
            modalAlert(err.responseText, "Association could not be added.")
          })
      }
    }

    let HTML = $('<div>').append('Node ID: ')
    NI.appendTo(HTML)
    HTML.append(' Endpoint: ');
    EI.appendTo(HTML);

    modalPrompt(HTML,'New Association',Buttons,true);
  }

  function DeleteAssociation() {

    let Association = JSON.parse($(this).attr('data-address'))

    let PL = [
      { nodeId: selectedNode, endpoint: parseInt($("#NODE_EP").val()) },
      parseInt($("#NODE_G").val()),
      [Association]
    ]

    let Buttons = {
      Yes: function () {
        ControllerCMD('AssociationsAPI', 'removeAssociations', undefined, PL)
          .then(() => { GMGroupSelected() })
          .catch((err) => {
            modalAlert(err.responseText, "Association Removal Failed")
          })
      }
    }

    modalPrompt('Are you sure you wish to remove this Association', 'Remove Association', Buttons, true)
    

  }

  function GMEndPointSelected() {

    let Endpoint = $(event.target).val()
    let GroupIDs = Object.keys(Groups[Endpoint])

    let GroupSelector = $("#NODE_G")
    GroupSelector.empty();
    $('<option>Select Group...</option>').appendTo(GroupSelector)

    GroupIDs.forEach((GID) => {
      let Group = Groups[Endpoint][GID];
      $('<option value="' + GID + '">' + GID + ' - ' + Group.label + '</option>').appendTo(GroupSelector)
    })

  }

  

  function GMGroupSelected() {

    let Endpoint = parseInt($("#NODE_EP").val());
    let Group = parseInt($("#NODE_G").val());
    
    let AA = {
      nodeId: parseInt(selectedNode),
      endpoint: Endpoint
    }

    ControllerCMD('AssociationsAPI', 'getAssociations', undefined, [AA])
      .then(({ object }) => {

        let Targets = object.Associations.filter((A) => A.GroupID === Group)

        $("#zwave-js-associations-table").find("tr:gt(0)").remove();

        // shoukd only be 1
        Targets.forEach((AG) => {
          AG.AssociationAddress.forEach((AD) => {

            let TR = $('<tr>')
            $('<td>').html(AD.nodeId).appendTo(TR)
            $('<td>').html(AD.endpoint ?? '0 (Root Device)').appendTo(TR)
            let TD3 = $('<td>').css({textAlign:'right'}).appendTo(TR)
            $('<input>').attr('type','button').addClass('ui-button ui-corner-all ui-widget').attr('value','Delete').attr('data-address',JSON.stringify(AD)).click(DeleteAssociation).appendTo(TD3)

            $("#zwave-js-associations-table").append(TR)

           })
        })
      });



  }

  function AssociationMGMT(){
    let Options = {
      draggable: false,
      modal: true,
      resizable: false,
      width: '800',
      height: '600',
      title: "ZWave Association Management: Node "+selectedNode,
      minHeight: 75,
      buttons: {
        Close: function () {
          $(this).dialog('destroy');
        }
      }
    }

    let Form = $('<div>').css({ padding: 60,paddingTop:30 }).html('Please wait...');
    Form.dialog(Options);

    ControllerCMD('AssociationsAPI','getAllAssociationGroups',undefined,[selectedNode])
      .then(({ object }) => {

        let Template = $('#TPL_Associations').html();
        let templateScript = Handlebars.compile(Template);
        let HTML = templateScript({ endpoints: object });

        Form.html('')
        Form.append(HTML);

        $("#AMAddBTN").click(AddAssociation)

        $("#NODE_EP").change(GMEndPointSelected)
        $("#NODE_G").change(GMGroupSelected)

        object.forEach((EP) => {
          Groups[EP.Endpoint] = {}
          EP.Groups.forEach((AG) => {
            Groups[EP.Endpoint][AG.GroupID] = {
              label: AG.AssociationGroupInfo.label,
              maxNodes: AG.AssociationGroupInfo.maxNodes
            }
          })
        })

      })
  }

  async function GenerateMapJSON(Nodes, Neigbhors) {

    let _Promises = [];
    let _Nodes = []
    let _Edges = []

    Nodes.forEach((N) => {

      let Label = N.isControllerNode ? 'Controller' : N.nodeId + ' - ' + (N.name ?? 'No Name')
      let name = N.isControllerNode ? 'Controller' : (N.name ?? 'No Name')
      let location = N.location ?? ''
      let Shape = N.isControllerNode ? 'box' : 'square'
      var Color = (N.isListening && N.isRouting) ? 'limegreen' : 'orangered'

      if (N.isControllerNode) {
        Color = 'lightgray'
      }
      let ND = {
        canRoute: N.isControllerNode || (N.isListening && N.isRouting),
        isControllerNode: N.isControllerNode,
        id: N.nodeId,
        label: Label,
        name: name,
        location: location,
        shape: Shape,
        manufacturer: 'Unknown',
        model: 'Unknown',
        status: N.status,
        color: {
          background: Color,
          borderColor: 'black',
          highlight: Color
        }
      }
      if (N.deviceConfig !== undefined) {
        ND.manufacturer = N.deviceConfig.manufacturer
        ND.model = N.deviceConfig.label
      }
      _Nodes.push(ND)
    })

    if (Neigbhors === undefined) {

      Nodes.forEach((N) => {

        if (N.isControllerNode) {
          return
        }

        let P = new Promise((res, rej) => {
          ControllerCMD('ControllerAPI', 'getNodeNeighbors', undefined,[N.nodeId])
            .then(({ node, object }) => {
              object.forEach((NodeNeighbor) => {
                let Neighbor = _Nodes.filter((Node) => Node.id === NodeNeighbor)[0];
                if (Neighbor.canRoute) {
                  let AlreadyAttached = _Edges.filter((E) => E.from === NodeNeighbor && E.to === node)
                  if (AlreadyAttached.length < 1) {
                    let Color = {
                      highlight: Neighbor.isControllerNode ? 'green' : '#000000',
                      color: '#d3d3d3'
                    }
                    _Edges.push({ color: Color, from: node, to: NodeNeighbor, arrows: { to: { enabled: true, type: 'arrow' } } })
                  } else {
                    _Edges.filter((E) => E.from === NodeNeighbor && E.to === node)[0].arrows.from = { enabled: true, type: 'arrow' }
                  }
                }
              })
              res();
            })
        })
        _Promises.push(P)
      })
      await Promise.all(_Promises)
    }
    else {
      Neigbhors.forEach(({ node, object }) => {
        if (_Nodes.filter((Node) => Node.id === node)[0].isControllerNode) {
          return
        }
        object.forEach((NodeNeighbor) => {
          let Neighbor = _Nodes.filter((Node) => Node.id === NodeNeighbor)[0];
          if (Neighbor.canRoute) {
            let AlreadyAttached = _Edges.filter((E) => E.from === NodeNeighbor && E.to === node)
            if (AlreadyAttached.length < 1) {
              let Color = {
                highlight: Neighbor.isControllerNode ? 'green' : '#000000',
                color: '#d3d3d3'
              }
              _Edges.push({ color: Color, from: node, to: NodeNeighbor, arrows: { to: { enabled: true, type: 'arrow' } } })
            } else {
              _Edges.filter((E) => E.from === NodeNeighbor && E.to === node)[0].arrows.from = { enabled: true, type: 'arrow' }
            }
          }
        });
      })
    }

    return { _Nodes, _Edges }
  }

  function NetworkMap() {

    var Network;

    let Options = {
      draggable: true,
      modal: true,
      resizable: true,
      width: '1024',
      height: '768',
      title: "ZWave Network Map. Routing is only an estimation, external influences can affect routing.",
      minHeight: 75,
      buttons: {
        Close: function () {
          Network.destroy();
          $(this).dialog('destroy');
        }
      }
    }

    let Window = $('<div>').css({ padding: 10 }).html('Generating Network Topology Map...');
    Window.dialog(Options)
    Window.on('dialogclose', () => { Network.destroy(); })


    let GetSpread = (Number) => {

      if (Number < 10) {
        return 100;
      }
      let Spread = Number * 10 + 100
      return Spread

    }

    ControllerCMD('ControllerAPI', 'getNodes')
      .then(({ object }) => {
        GenerateMapJSON(object)
          .then(({ _Nodes, _Edges }) => {

            let data = {
              nodes: new vis.DataSet(_Nodes),
              edges: new vis.DataSet(_Edges)
            }
            let options = {
              nodes: {
                size: 8,
                font: {
                  size: 8,
                },
                borderWidth: 1,
                shadow: true,
              },
              edges: {
                shadow: false,
                width: 0.15,
                length: GetSpread(_Nodes.length),
                smooth: {
                  type: "discrete",
                },
                physics: true
              },
              physics: {
                enabled: false,
                solver: "repulsion",
                repulsion: {
                  nodeDistance: GetSpread(_Nodes.length)
                }
              }
            }

            let Template = $('#TPL_Map').html();
            let templateScript = Handlebars.compile(Template);
            let HTML = templateScript({});

            Window.html('');
            Window.append(HTML)

            Network = new vis.Network($('#Network')[0], data, options);
            Network.on('click', (E) => {

              if (E.nodes.length > 0) {

                let SelectedNode = data.nodes.get(E.nodes[0])

                let RouteTargets = _Edges.filter((RT) => RT.from === SelectedNode.id)
                let RouteChildren = _Edges.filter((RT) => RT.to === SelectedNode.id)

                let Targets = []
                RouteTargets.forEach((T) => Targets.push(T.to))
                let Children = []
                RouteChildren.forEach((T) => Children.push(T.from))

                $("#NM_ID").html(SelectedNode.id)
                $("#NM_Name").html(SelectedNode.name)
                $("#NM_LOC").html(SelectedNode.location)
                $("#NM_MOD").html(SelectedNode.manufacturer + ' / ' + SelectedNode.model)
                $("#NM_Status").html(SelectedNode.status)
                $("#NM_Slaves").html(Targets.toString())
                $("#NM_Clients").html(Children.toString())

                if(SelectedNode.isControllerNode){
                  GetControllerStats()
                }
                else{
                  GetNodeStats(SelectedNode.id)
                }

              } else {
                $("#zwave-js-selected-node-map-info-stats").html('RX:0, <span style="color: red;">RXD:0</span>, TX:0, <span style="color: red;">TXD:0</span>, <span style="color: red;">TO:0</span>')
                $("#NM_ID").html('No Node Selected')
                $("#NM_Name").html('&nbsp;')
                $("#NM_LOC").html('&nbsp;')
                $("#NM_MOD").html('&nbsp;')
                $("#NM_Status").html('&nbsp;')
                $("#NM_Slaves").html('&nbsp;')
                $("#NM_Clients").html('&nbsp;')
              }
            })

            Network.stabilize()

          })
      })
  }

  function GetControllerStats() {
    ControllerCMD('DriverAPI', 'getControllerStatistics', undefined)
      .then(({ object }) => {
        $("#zwave-js-selected-node-map-info-stats").html('RX:' + object.messagesRX + ', <span style="color: red;">RXD:' + object.messagesDroppedRX + '</span>, TX:' + object.messagesTX + ', <span style="color: red;">TXD:' + object.messagesDroppedTX + '</span>, <span style="color: red;">TO:' + object.timeoutResponse + '</span>')
      });
  }

  function GetNodeStats(NodeID){
    ControllerCMD('DriverAPI','getNodeStatistics',undefined,[NodeID])
    .then(({object}) =>{
      if(object.hasOwnProperty(NodeID.toString())){
        let Stats = object[NodeID.toString()];
        $("#zwave-js-selected-node-map-info-stats").html('RX:'+Stats.commandsRX+', <span style="color: red;">RXD:'+Stats.commandsDroppedRX+'</span>, TX:'+Stats.commandsTX+', <span style="color: red;">TXD:'+Stats.commandsDroppedTX+'</span>, <span style="color: red;">TO:'+Stats.timeoutResponse+'</span>')
      }
      else{
        $("#zwave-js-selected-node-map-info-stats").html('RX:0, <span style="color: red;">RXD:0</span>, TX:0, <span style="color: red;">TXD:0</span>, <span style="color: red;">TO:0</span>')
      }
    })
  }
 



  var controllerOpts;
  var nodeOpts;

  function ShowHideNodeOptions() {
    if (nodeOpts.is(':visible')) {
      cancelSetName()
      $(this).html('Show Node Options')
      nodeOpts.hide()
    } else {
      $(this).html('Hide Node Options')
      nodeOpts.show()
    }
  }

  function ShowHideController() {
    if (controllerOpts.is(':visible')) {
      $(this).html('Show Controller Options')
      controllerOpts.hide()
    } else {
      $(this).html('Hide Controller Options')
      controllerOpts.show()
      getLatestStatus();
    }
  }

  function ControllerCMD(mode, method, node, params, dontwait) {

    let Options = {
      url: `zwave-js/cmd`,
      method: 'POST',
      contentType: 'application/json',
    }

    let Payload = {
      mode: mode,
      method: method
    }
    if (node !== undefined) {
      Payload.node = node;
    }
    if (params !== undefined) {
      Payload.params = params;
    }
    if (dontwait !== undefined) {
      Payload.noWait = dontwait;
    }

    Options.data = JSON.stringify(Payload)
    return $.ajax(Options)

  }

  function GetNodes() {

    ControllerCMD('ControllerAPI', 'getNodes')
      .then(({ object }) => {
        let controllerNode = object.filter(N => N.isControllerNode)
        if (controllerNode.length > 0) {
          makeInfo('#zwave-js-controller-info', controllerNode[0].deviceConfig, controllerNode[0].firmwareVersion)
        }
        $('#zwave-js-node-list').empty().append(object.filter(node => node && !node.isControllerNode).map(renderNode))
      })
      .catch((err) => {
        console.error(err);
      })
  }

  function StartInclude() {
    let Buttons = {
      'Yes (Secure)': function () {
        ControllerCMD('ControllerAPI', 'beginInclusion', undefined,[false], true)
      },
      'Yes (Insecure)': function () {
        ControllerCMD('ControllerAPI', 'beginInclusion', undefined,[true], true)
      }
    }
    modalPrompt('Begin the include process?', 'Include Mode', Buttons, true)
  }

  function StopInclude() {
    ControllerCMD('ControllerAPI', 'stopInclusion', undefined,undefined, true)
  }

  function StartExclude() {
    ControllerCMD('ControllerAPI', 'beginExclusion', undefined,undefined, true)
  }

  function StopExclude() {
    ControllerCMD('ControllerAPI', 'stopExclusion', undefined,undefined, true)
  }

  function StartHeal() {
    ControllerCMD('ControllerAPI', 'beginHealingNetwork', undefined,undefined, true)
  }

  function StopHeal() {
    ControllerCMD('ControllerAPI', 'stopHealingNetwork', undefined,undefined, true)
  }

  function Reset() {
    let Buttons = {
      'Yes - Reset': function () {
        ControllerCMD('ControllerAPI', 'hardReset')
          .then(() => {
            modalAlert('Your Controller has been reset.', 'Reset Complete')
            GetNodes();
          })
      }
    }
    modalPrompt('Are you sure you wish to reset your Controller? This action is irreversible, and will clear the Controllers data and configuration.', 'Reset Controller', Buttons, true)
  }

  function RenameNode() {

    let input = $(this).prev()
    if (input.is(':visible')) {
      ControllerCMD('ControllerAPI', 'setNodeName',undefined, [selectedNode, input.val()])
        .then(({ node, object }) => {
          $('#zwave-js-node-list').find(`[data-nodeid='${node}'] .zwave-js-node-row-name`).html(object)
          if (node == selectedNode) {
            $('#zwave-js-selected-node-name').text(object)
          }
          GetNodes();
          input.hide()
          $(this).html('Set Name')
        })
    } else {
      input.show()
      input.val($('#zwave-js-selected-node-name').text())
      $(this).html('Go')
    }
  }

  function SetNodeLocation() {

    let input = $(this).prev()
    if (input.is(':visible')) {
      ControllerCMD('ControllerAPI', 'setNodeLocation', undefined,[selectedNode, input.val()])
        .then(({ node, object }) => {
          $('#zwave-js-node-list').find(`[data-nodeid='${node}'] .zwave-js-node-row-location`).html("(" + object + ")")
          if (node == selectedNode) {
            $('#zwave-js-selected-node-location').text(object)
          }
          GetNodes();
          input.hide()
          $(this).html('Set Location')
        })
    } else {
      input.show()
      input.val($('#zwave-js-selected-node-location').text())
      $(this).html('Go')
    }
  }

  function InterviewNode() {
    ControllerCMD('ControllerAPI', 'refreshInfo', undefined,[selectedNode])
      .catch((err) => {
        if (err.status !== 504) {
          modalAlert(err.responseText, 'Interview Error')
        }
      })
  }

  function OpenDB() {
    let info = $(`.zwave-js-node-row.selected`).data('info')?.deviceConfig || {}
    let id = [
      '0x' + info.manufacturerId.toString(16).padStart(4, '0'),
      '0x' + info.devices[0].productType.toString(16).padStart(4, '0'),
      '0x' + info.devices[0].productId.toString(16).padStart(4, '0'),
      info.firmwareVersion.min
    ].join(':')
    window.open(`https://devices.zwave-js.io/?jumpTo=${id}`, '_blank')
  }

  function RemoveFailedNode() {
    let Buttons = {
      'Yes - Remove': function () {
        ControllerCMD('ControllerAPI', 'removeFailedNode', undefined,[selectedNode])
          .catch((err) => {
            if (err.status !== 504) {
              modalAlert(err.responseText, 'Could Not Remove Node')
            }
          })
      }
    }
    modalPrompt('Are you sure you wish to remove this node?', 'Remove Failed Node', Buttons, true);
  }

  function ReplaceFailedNode() {
    let Buttons = {
      'Yes (Secure)': function () {
        ControllerCMD('ControllerAPI', 'replaceFailedNode', undefined,[selectedNode, false])
          .catch((err) => {
            if (err.status !== 504) {
              modalAlert(err.responseText, 'Could Not Replace Node')
            }
          })
      },
      'Yes (Insecure)': function () {
        ControllerCMD('ControllerAPI', 'replaceFailedNode',undefined, [selectedNode, true])
          .catch((err) => {
            if (err.status !== 504) {
              modalAlert(err.responseText, 'Could Not Replace Node')
            }
          })
      }
    }
    modalPrompt('Are you sure you wish to replace this node?', 'Replace Failed Node', Buttons, true);
  }


  function init() {

    // Container(s)
    let content = $('<div>').addClass('red-ui-sidebar-info').css({ position: 'relative', height: '100%', overflowY: 'hidden', display: 'flex', flexDirection: 'column' })
    let stackContainer = $('<div>').addClass('red-ui-sidebar-info-stack').appendTo(content)

    // Main Panel
    let mainPanel = $('<div>').css({ overflow: 'hidden', display: 'flex', flexDirection: 'column' }).appendTo(stackContainer)

    /* ---------- Controller Section ---------- */

    // Controller Header
    let controllerHeader = $('<div>').addClass('red-ui-sidebar-header').css({ flex: '0 0 auto', textAlign: 'left', padding: 5 }).appendTo(mainPanel)
    $('<input type="checkbox" id="node-properties-auto-expand">').css({ margin: '0 2px' }).appendTo(controllerHeader)
    $('<span>').html('Expand CC\'s').appendTo(controllerHeader)
    $('<button>').addClass('red-ui-button red-ui-button-small').css({ float: 'right' }).html('Show Controller Options').click(ShowHideController).appendTo(controllerHeader)

    // Controller Options
    controllerOpts = $('<div>').appendTo(controllerHeader).hide()

    // Info
    $('<div id="zwave-js-controller-info">').addClass('zwave-js-info-box').appendTo(controllerOpts)
    $('<div id="zwave-js-controller-status">').addClass('zwave-js-info-box').html('Waiting for update...').appendTo(controllerOpts)

    // Include
    let optInclusion = $('<div>').css('text-align', 'center').appendTo(controllerOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(StartInclude).html('Start Inclusion').appendTo(optInclusion)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(StopInclude).html('Stop Inclusion').appendTo(optInclusion)

    // Exclude
    let optExclusion = $('<div>').css('text-align', 'center').appendTo(controllerOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(StartExclude).html('Start Exclusion').appendTo(optExclusion)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(StopExclude).html('Stop Exclusion').appendTo(optExclusion)

    // Heal
    let optHeal = $('<div>').css('text-align', 'center').appendTo(controllerOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(StartHeal).html('Start Network Heal').appendTo(optHeal)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(StopHeal).html('Stop Network Heal').appendTo(optHeal)

    // Refresh, Reset
    let optRefreshReset = $('<div>').css('text-align', 'center').appendTo(controllerOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(GetNodes).html('Refresh Node List').appendTo(optRefreshReset)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(Reset).html('Reset Controller').appendTo(optRefreshReset)

    // Tools
    let tools = $('<div>').css('text-align', 'center').appendTo(controllerOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(FirmwareUpdate).html('Firmware Updater').appendTo(tools)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(NetworkMap).html('Network Map').appendTo(tools)

    // Node List
    $('<div id="zwave-js-node-list">').css({ flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflowY: 'auto' }).appendTo(mainPanel)

    /* ---------- Node Section ---------- */

    // Node Panel
    let nodePanel = $('<div>').css({ overflow: 'hidden', display: 'flex', flexDirection: 'column' }).appendTo(stackContainer)

    // Node Header
    let nodeHeader = $('<div>', { class: 'red-ui-palette-header red-ui-info-header' }).css({ flex: '0 0 auto' }).appendTo(nodePanel)
    $('<span id="zwave-js-selected-node-id">').appendTo(nodeHeader)
    $('<span id="zwave-js-selected-node-name">').appendTo(nodeHeader)
    $('<span id="zwave-js-selected-node-location">').appendTo(nodeHeader)
    $('<button>').addClass('red-ui-button red-ui-button-small').css({ float: 'right' }).click(ShowHideNodeOptions).html('Show Node Options').appendTo(nodeHeader)

    // node Options
    nodeOpts = $('<div>').appendTo(nodeHeader).hide()

    // Info
    $('<div id="zwave-js-selected-node-info">').addClass('zwave-js-info-box').appendTo(nodeOpts)

    // Rename
    let rename = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<input>').addClass('red-ui-searchBox-input').hide().appendTo(rename)
    $('<button id="zwave-js-set-node-name">').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(RenameNode).html('Set Name').appendTo(rename)

    // Location
    let location = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<input>').addClass('red-ui-searchBox-input').hide().appendTo(location)
    $('<button id="zwave-js-set-node-location">').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(SetNodeLocation).html('Set Location').appendTo(location)

    // Interview
    let optInterview = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(InterviewNode).html('Interview Node').appendTo(optInterview)

    // Remove
    let RemoveFailed = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(RemoveFailedNode).html('Remove Failed Node').appendTo(RemoveFailed)

    // Remove
    let ReplaceFailed = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(ReplaceFailedNode).html('Replace Failed Node').appendTo(ReplaceFailed)

    // Association
    let Association = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(AssociationMGMT).html('Association Management').appendTo(Association)

    // Refres Properties
    let RefresProps = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(getProperties).html('Refresh Property List').appendTo(RefresProps)

    // DB
    let DB = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').click(OpenDB).html('View in Config Database').appendTo(DB)

    // Endpoint Filter
    $('<div id="zwave-js-node-endpoint-filter">').appendTo(nodeOpts)

    // Node Proeprties List
    $('<div id="zwave-js-node-properties">').css({ width: '100%', height: '100%' }).appendTo(nodePanel).treeList({ data: [] })

    // Build stack
    panels = RED.panels.create({ container: stackContainer })
    panels.ratio(0.5)

    let resizeStack = () => panels.resize(content.height())
    RED.events.on('sidebar:resize', resizeStack)
    $(window).on('resize', resizeStack)
    $(window).on('focus', resizeStack)

    // Add tab
    RED.sidebar.addTab({
      id: 'zwave-js',
      label: ' ZWave JS',
      name: 'Z-Wave JS',
      content,
      enableOnEdit: true,
      iconClass: 'fa fa-feed',
      onchange: () => setTimeout(resizeStack, 0) // Only way I can figure out how to init the resize when tab becomes visible
    })
    RED.comms.subscribe(`/zwave-js/cmd`, handleControllerEvent)
    RED.comms.subscribe(`/zwave-js/status`, handleStatusUpdate)

    GetNodes();

  }
  // Init done

  function handleStatusUpdate(topic, data) {
    $('#zwave-js-controller-status').html(data.status)
  }

  function handleControllerEvent(topic, data) {

    switch (data.type) {
      case 'controller-event':
        let eventType = data.event.split(' ')[0]
        switch (eventType) {
          case 'node':
            GetNodes()
        }
        break

      case 'node-status':
        let nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${data.node}']`)
        if (data.status == 'READY') {
          nodeRow.find('.zwave-js-node-row-ready').html(renderReadyIcon(true))
        } else {
          nodeRow.find('.zwave-js-node-row-status').html(data.status.toUpperCase())
        }
        break

    }
  }



  function renderNode(node) {
    return $('<div>')
      .addClass('red-ui-treeList-label zwave-js-node-row')
      .attr('data-nodeid', node.nodeId)
      .data('info', node)
      .click(() => selectNode(node.nodeId))
      .append(
        $('<div>').html(node.nodeId).addClass('zwave-js-node-row-id'),
        $('<div>').html(node.name).addClass('zwave-js-node-row-name'),
        $('<div>').html(node.status.toUpperCase()).addClass('zwave-js-node-row-status'),
        $('<div>').html(renderReadyIcon(node.ready)).addClass('zwave-js-node-row-ready')
      )
  }

  function renderReadyIcon(isReady) {
    let i = $('<i>')

    if (isReady) {
      i.addClass('fa fa-thumbs-up')
      RED.popover.tooltip(i, 'Ready')
    }

    return i
  }

  function makeInfo(elId, deviceConfig = {}, firmwareVersion) {
    let el = $(elId)

    el.empty().append(
      $('<span>').text(`${deviceConfig.manufacturer} | ${deviceConfig.label} | FW: ${firmwareVersion}`),

    )

  }

  function cancelSetName() {
    let setNameButton = $('#zwave-js-set-node-name')
    if (setNameButton.html() == 'Go') setNameButton.html('Set Name').prev().hide()
  }

  let selectedNode

  function deselectCurrentNode() {
    // "Disconnect" from previously selected node
    if (selectedNode) {
      $(`#zwave-js-node-list [data-nodeid='${selectedNode}']`).removeClass('selected')

      cancelSetName()

      $('#zwave-js-status-box-interview').text('')

      $('#zwave-js-node-properties').treeList('empty')
      RED.comms.unsubscribe(`/zwave-js/cmd/${selectedNode}`, handleNodeEvent)
    }
  }

  function selectNode(id) {
    if (selectedNode == id) return
    deselectCurrentNode()

    selectedNode = id
    let selectedEl = $(`#zwave-js-node-list [data-nodeid='${id}']`)
    selectedEl.addClass('selected')
    $('#zwave-js-selected-node-id').text(selectedNode)
    let info = selectedEl.data('info')

    if (info.name !== undefined && info.name.length > 0) {
      $('#zwave-js-selected-node-name').text(info.name)
    }
    else {
      $('#zwave-js-selected-node-name').text("")
    }

    if (info.location !== undefined && info.location.length > 0) {
      $('#zwave-js-selected-node-location').text("(" + info.location + ")")
    }
    else {
      $('#zwave-js-selected-node-location').text("")
    }

    makeInfo('#zwave-js-selected-node-info', info.deviceConfig, info.firmwareVersion)
    getProperties()
    RED.comms.subscribe(`/zwave-js/cmd/${selectedNode}`, handleNodeEvent)
  }

  function handleNodeEvent(topic, data) {
    let nodeId = topic.split('/')[3]
    if (nodeId != selectedNode) return
    switch (data.type) {

      case 'node-value':
        updateValue(data.payload)
        break

      case 'node-meta':
        updateMeta(data.payload, data.payload.metadata)
        break

      case 'node-fwu-progress':
        let Sent = data.payload.sent;
        let Remain = data.payload.remain;
        let Percent = (Sent / Remain) * 100;
        $("#progressbar > div").css({ 'width': Percent + '%' })
        break

      case 'node-fwu-completed':
        deselectCurrentNode();
        FWRunning = false;
        FirmwareForm.dialog('destroy');

        let nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${nodeId}']`)
        
        switch (data.payload.status) {
          case 253:
            modalAlert('The firmware for node ' + nodeId + ' has been updated. Activation is pending.', 'ZWave Device Firmware Update')
            nodeRow.find('.zwave-js-node-row-status').html('FIRMWARE UPDATED')
            break;
          case 254:
            modalAlert('The firmware for node ' + nodeId + ' has been updated.', 'ZWave Device Firmware Update')
            nodeRow.find('.zwave-js-node-row-status').html('FIRMWARE UPDATED')
            break;
          case 255:
            modalAlert('The firmware for node ' + nodeId + ' has been updated. A restart is required (which may happen automatically)', 'ZWave Device Firmware Update')
            nodeRow.find('.zwave-js-node-row-status').html('FIRMWARE UPDATED')
            break;
          default:
            modalAlert('The firmware for node ' + nodeId + ' failed to get updated. Error Code: ' + data.payload.status, 'ZWave Device Firmware Update')
            nodeRow.find('.zwave-js-node-row-status').html('UPDATE FAILED')
        }
        break;
    }
  }

  function updateNodeFetchStatus(text) {
    $('#zwave-js-node-properties').treeList('data', [
      {
        label: text,
        class: 'zwave-js-node-fetch-status'
      }
    ])
  }

  function getProperties() {

    updateNodeFetchStatus('Fetching properties...')

    ControllerCMD('ValueAPI','getDefinedValueIDs', selectedNode)
    .then(({object}) => buildPropertyTree(object))

  }

  let uniqBy = (collection, ...props) => {
    let uniqMap = {}
    collection.forEach(obj => {
      let key = props.map(p => obj[p]).join('-')
      if (!uniqMap.hasOwnProperty(key)) uniqMap[key] = obj
    })
    return Object.values(uniqMap)
  }

  function buildPropertyTree(valueIdList) {
    if (valueIdList.length == 0) {
      updateNodeFetchStatus('No properties found')
      return
    }
    updateNodeFetchStatus('')

    // Step 1: Make list of all supported command classes
    let data = uniqBy(valueIdList, 'commandClass')
      .sort((a, b) => a.commandClassName.localeCompare(b.commandClassName))
      .map(({ commandClass, commandClassName }) => {
        // Step 2: For each CC, get all associated properties
        let propsInCC = valueIdList.filter(valueId => valueId.commandClass == commandClass)

        return {
          element: renderCommandClassElement(commandClass, commandClassName),
          expanded: $("#node-properties-auto-expand").is(':checked'),
          children: propsInCC.map(valueId => {
            return { element: renderPropertyElement(valueId) }
          })
        }
      })

    // Step 3: Render tree
    let propertyList = $('#zwave-js-node-properties')
    propertyList.treeList('data', data)

    // Step 4: Add endpoint numbers where applicable
    propertyList
      .find('.zwave-js-node-property')
      .filter(function () {
        return +$(this).attr('data-endpoint') > 0
      })
      .each(function () {
        $(this)
          .prev()
          .prev()
          .html(
            $('<span>')
              .addClass('zwave-js-node-property-endpoint')
              .text(+$(this).attr('data-endpoint'))
          )
      })

    // Step 5: Build endpoint filter buttons
    let endpoints = uniqBy(valueIdList, 'endpoint').map(valueId => valueId.endpoint)
    let filter = $('#zwave-js-node-endpoint-filter')
    filter.empty()
    if (endpoints.length > 1) {
      filter.append(
        'Filter by endpoint:',
        endpoints.map(ep => {
          return $('<button>')
            .addClass('red-ui-button red-ui-button-small')
            .css({ marginLeft: 1 })
            .text(ep)
            .click(() => {
              $('.zwave-js-node-property').closest('li').hide()
              $(`.zwave-js-node-property[data-endpoint="${ep}"]`).closest('li').show()
            })
        }),
        $('<button>')
          .addClass('red-ui-button red-ui-button-small')
          .css({ marginLeft: 1 })
          .text('ALL')
          .click(() => {
            $('.zwave-js-node-property').closest('li').show()
          })
      )
    }
  }

  function renderCommandClassElement(commandClass, commandClassName) {
    let el = $('<span>').text(commandClassName)
    RED.popover.tooltip(el, hexDisplay(commandClass))
    return el
  }

  function renderPropertyElement(valueId) {
    let el = $('<div>')
      .addClass('zwave-js-node-property')
      .attr('data-endpoint', valueId.endpoint)
      .attr('data-propertyId', makePropertyId(valueId))
      .data('valueId', valueId)
    let label =
      valueId.propertyKeyName ??
      valueId.propertyName ??
      valueId.property +
      (valueId.propertyKey !== undefined
        ? `[0x${valueId.propertyKey.toString(16).toUpperCase().padStart(2, '0')}]`
        : '')
    $('<span>').addClass('zwave-js-node-property-name').text(label).appendTo(el)
    $('<span>').addClass('zwave-js-node-property-value').appendTo(el)
    getValue(valueId)
    el.dblclick(function () {
      let data = $(this).data()
      let valueData = $(this).find('.zwave-js-node-property-value').data()
      $('<div>')
        .css({ maxHeight: '80%' })
        .html(`<pre>${JSON.stringify({ ...data, valueData }, null, 2)}</pre>`)
        .dialog({
          draggable: true,
          modal: true,
          resizable: false,
          width: 'auto',
          title: 'Information',
          minHeight: 75,
          buttons: {
            Close: function () {
              $(this).dialog('destroy')
            }
          }
        })
    })
    return el
  }

  function getValue(valueId) {

    ControllerCMD('ValueAPI','getValue',selectedNode,[valueId])
    .then(({node, object: { valueId, response: value }}) =>{

      if (node != selectedNode){
        return
      }
      updateValue({ ...valueId, value })
      ControllerCMD('ValueAPI','getValueMetadata',selectedNode,[valueId])
      .then(({node, object: { valueId, response: meta } }) =>{
        if(!meta || node != selectedNode){
          return;
        }
        updateMeta(valueId, meta)
      })
    })
  }

  function updateValue(valueId) {
    // Assumes you already checked if this applies to selectedNode

    let propertyRow = getPropertyRow(valueId)

    if (!propertyRow) {
      // AHHH!!! What do we do now?!
      // No easy way to insert a branch into the treeList.
      // So for now, just re-fetch the entire property list.
      // We'll figure out something better later.
      getProperties()
      return
    }

    let propertyValue = propertyRow.find('.zwave-js-node-property-value')
    let meta = propertyRow.data('meta')

    // Check if this is a 'value removed' event
    if (valueId.hasOwnProperty('prevValue') && !valueId.hasOwnProperty('newValue')) {
      propertyValue.text('')
      return
    }

    // If value is not provided in arguments or in the valueId, then use the stored raw value.
    let value = valueId?.newValue ?? valueId?.value ?? propertyValue.data('value') ?? ''

    if (meta?.states?.[value]) {
      // If meta known, translate the value and add tooltip with raw value
      propertyValue.text(meta?.states?.[value])
      RED.popover.tooltip(propertyValue, `Raw Value: ${value}`)
    } else if (valueId.commandClass == 114) {
      // If command class "Manufacturer Specific", show hex values
      propertyValue.text(hexDisplay(value))
      if (valueId.property == 'manufacturerId')
        RED.popover.tooltip(
          propertyValue,
          $(`#zwave-js-node-list .selected`).data('info')?.deviceConfig?.manufacturer
        )
    } else if (propertyValue.data('unit')) {
      // If has units, include
      propertyValue.text(value + propertyValue.data('unit'))
    } else {
      // Otherwise just display raw value
      propertyValue.text(value)
    }

    // Some formatting
    if (/^(true|false)$/.test(value)) {
      propertyValue.addClass(`zwave-js-property-value-type-boolean`)
    }

    // Store raw value in data
    propertyValue.data('value', value)
  }

  function updateMeta(valueId, meta = {}) {
    // Assumes you already checked if this applies to selectedNode

    let propertyRow = getPropertyRow(valueId)
    let propertyValue = propertyRow.find('.zwave-js-node-property-value')

    propertyRow.data('meta', meta)

    // Update label and/or description
    let propertyName = propertyRow.find('.zwave-js-node-property-name')
    if (meta.hasOwnProperty('label')) propertyName.text(meta.label)
    if (meta.hasOwnProperty('description')) RED.popover.tooltip(propertyName, meta.description)

    // If states are provided, translate and add tooltip with raw value
    let value = propertyValue.data('value')
    if (meta?.states?.[value]) {
      propertyValue.text(meta?.states?.[value])
      RED.popover.tooltip(propertyValue, `Raw Value: ${value}`)
    }

    // If unit is provided, add to value
    if (meta.hasOwnProperty('unit')) {
      propertyValue.data('unit', meta.unit)
      propertyValue.text(value + meta.unit)
    }

    // Add "edit" icon, if applicable
    let icon = propertyRow.prev()
    icon.empty()
    if (meta.writeable)
      $('<i>')
        .addClass('fa fa-pencil zwave-js-node-property-edit-button')
        .click(() => showEditor(valueId))
        .appendTo(icon)
  }

  function showEditor(valueId) {
    let propertyRow = getPropertyRow(valueId)

    // If editor is already displayed, close it instead
    let next = propertyRow.next()
    if (next.is('.zwave-js-node-property-editor')) {
      next.remove()
      return
    }

    let meta = propertyRow.data('meta')

    if (meta.writeable) {
      // Step 1: Create editor block and add below value block

      let editor = $('<div>').addClass('zwave-js-node-property-editor').css({ paddingLeft: 40 })

      propertyRow.after(editor)

      function makeSetButton(val) {
        return $('<button>')
          .addClass('red-ui-button red-ui-button-small')
          .css({ marginRight: 5 })
          .html('Set')
          .click(() => {

            if (val == undefined) val = input.val()
            if (meta.type == 'number') val = +val

            ControllerCMD('ValueAPI','setValue',selectedNode,[valueId,val],true)
            editor.remove();

          })
      }
      function makeInfoStr(...fields) {
        return fields
          .map(([label, prop]) => meta.hasOwnProperty(prop) && `${label}: ${meta[prop]}`)
          .filter(s => s)
          .join(' | ')
      }

      let input = $('<input>')

      // Step 2: Generate input(s) with Set button(s)

      if (meta.hasOwnProperty('states')) {
        // STATES
        editor.append(
          Object.entries(meta.states).map(([val, label]) => {
            let labelSpan = $('<span>').text(label)
            RED.popover.tooltip(labelSpan, `Raw Value: ${val}`)
            return $('<div>').append(makeSetButton(val), labelSpan)
          })
        )
      }

      if (meta.allowManualEntry === undefined ||  meta.allowManualEntry ) {
        if (meta.type == 'number') {
          // Number
          editor.append(
            input,
            makeSetButton(),
            $('<span>').text(
              makeInfoStr(['Default', 'default'], ['Min', 'min'], ['Max', 'max'], ['Step', 'step'])
            )
          )
        } else if (meta.type == 'boolean') {
          // BOOLEAN
          editor.append(
            $('<div>').append(
              makeSetButton(true),
              $('<span>').addClass('zwave-js-property-value-type-boolean').text('True')
            ),
            $('<div>').append(
              makeSetButton(false),
              $('<span>').addClass('zwave-js-property-value-type-boolean').text('False')
            )
          )
        } else if (meta.type == 'string') {
          // STRING
          editor.append(
            input,
            makeSetButton(),
            $('<span>').text(makeInfoStr(['Min Length', 'minLength'], ['Max Length', 'maxLength']))
          )
        } else if (meta.type == 'any') {
          // ANY
          editor.append(input, makeSetButton(), $('<span>').html('Caution: ValueType is "Any"'))
          return
        } else {
          // How did you get here?
          editor.append('Missing ValueType')
          return
        }
      }


    }
  }

  function hexDisplay(integer) {
    return `#${integer} | 0x${integer.toString(16).toUpperCase().padStart(4, '0')}`
  }

  function makePropertyId(valueId) {
    return [
      valueId.endpoint || '0',
      valueId.commandClass,
      valueId.property,
      valueId.propertyKey
    ].join('-')
  }

  function getPropertyRow(valueId) {
    return $(`#zwave-js-node-properties [data-propertyId="${makePropertyId(valueId)}"]`)
  }

  function getLatestStatus(req) {
    $.ajax({
      url: `zwave-js/fetch-driver-status`,
      method: 'GET',
    })
  }

  return { init }
})()
