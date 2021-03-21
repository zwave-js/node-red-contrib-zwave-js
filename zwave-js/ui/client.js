let ZwaveJsUI = (function () {
  const AUTO_HIDE_CC = [
    'Association',
    'Association Group Information',
    'Firmware Update Meta Data',
    'Manufacturer Specific',
    'Multi Channel',
    'Multi Channel Association',
    'Node Naming and Location',
    'Version',
    'Z-Wave Plus Info'
  ]

  function confirm(text, onYes, onCancel) {
    $('<div>')
      .css({ padding: 10, maxWidth: 500, wordWrap: 'break-word' })
      .html(text)
      .dialog({
        draggable: false,
        modal: true,
        resizable: false,
        width: 'auto',
        title: 'Confirm',
        minHeight: 75,
        buttons: {
          Yes: function () {
            onYes?.()
            $(this).dialog('destroy')
          },
          Cancel: function () {
            onCancel?.()
            $(this).dialog('destroy')
          }
        }
      })
  }

  function init() {
    // Sidebar container

    let content = $('<div>').addClass('red-ui-sidebar-info').css({
      position: 'relative',
      height: '100%',
      overflowY: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    })

    let stackContainer = $('<div>').addClass('red-ui-sidebar-info-stack').appendTo(content)

    // -- Controller panel

    let controllerPanel = $('<div>')
      .css({
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      })
      .appendTo(stackContainer)

    // -- -- Controller header (selector + opts button)

    let controllerHeader = $('<div>')
      .addClass('red-ui-sidebar-header')
      .css({ flex: '0 0 auto', textAlign: 'left', padding: 5 })
      .appendTo(controllerPanel)

    $('<select id="zwave-js-controller">')
      .css({ height: 20, width: 100, margin: 0, padding: 0, fontSize: 12 })
      .change(function () {
        $(this).val() && selectController($(this).val())
      })
      .appendTo(controllerHeader)

    $('<button>')
      .addClass('red-ui-button red-ui-button-small')
      .html('<i class="fa fa-refresh"></i>')
      .click(() => getControllers())
      .appendTo(controllerHeader)

    $('<button>')
      .addClass('red-ui-button red-ui-button-small')
      .css({ float: 'right' })
      .html('Show Controller Options')
      .click(function () {
        if (controllerOpts.is(':visible')) {
          $(this).html('Show Controller Options')
          controllerOpts.hide()
        } else {
          $(this).html('Hide Controller Options')
          controllerOpts.show()
        }
      })
      .appendTo(controllerHeader)

    // -- -- -- Controller options

    let controllerOpts = $('<div>').appendTo(controllerHeader).hide()

    function makeControllerOption(text, operation, paramGenerator) {
      return $('<button>')
        .addClass('red-ui-button red-ui-button-small')
        .html(text)
        .click(() => {
          let params = paramGenerator ? paramGenerator() : undefined
          console.log({ params })
          controllerRequest({
            class: 'Controller',
            operation,
            params,
            noWait: true
          })
        })
    }

    // -- -- -- -- Controller info

    $('<div id="zwave-js-controller-info">').addClass('zwave-js-info-box').appendTo(controllerOpts)

    // -- -- -- -- Inclusion

    let optInclusion = $('<div>')
      .css({ display: 'inline-flex', alignItems: 'center' })
      .appendTo(controllerOpts)
    makeControllerOption('Start Inclusion', 'StartInclusion', () => {
      return [$('#zwave-js-insecure-inclusion').is(':checked')]
    }).appendTo(optInclusion)
    $('<input type="checkbox" id="zwave-js-insecure-inclusion">')
      .css({ margin: '0 2px' })
      .appendTo(optInclusion)
    $('<span>').css({ margin: '0 2px', fontSize: 'x-small' }).text('Insecure').appendTo(optInclusion)
    makeControllerOption('Stop Inclusion', 'StopInclusion').appendTo(optInclusion)
    $('<span id="zwave-js-status-box-inclusion">')
      .addClass('zwave-js-status-box')
      .appendTo(optInclusion)

    // -- -- -- -- Exclusion

    let optExclusion = $('<div>').appendTo(controllerOpts)
    makeControllerOption('Start Exclusion', 'StartExclusion').appendTo(optExclusion)
    makeControllerOption('Stop Exclusion', 'StopExclusion').appendTo(optExclusion)
    $('<span id="zwave-js-status-box-exclusion">')
      .addClass('zwave-js-status-box')
      .appendTo(optExclusion)

    // -- -- -- -- Heal network

    let optHeal = $('<div>').appendTo(controllerOpts)
    makeControllerOption('Start Heal Network', 'StartHealNetwork').appendTo(optHeal)
    makeControllerOption('Stop Heal Network', 'StopHealNetwork').appendTo(optHeal)
    $('<span id="zwave-js-status-box-heal">').addClass('zwave-js-status-box').appendTo(optHeal)

    // -- -- -- -- Refresh node list

    $('<button>')
      .addClass('red-ui-button red-ui-button-small')
      .html('Refresh Node List')
      .click(() => getNodes(selectedController))
      .appendTo(controllerOpts)

    // -- -- Controller node list

    $('<div id="zwave-js-node-list">')
      .css({ flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflowY: 'auto' })
      .appendTo(controllerPanel)

    // -- Node panel

    let nodePanel = $('<div>')
      .css({
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      })
      .appendTo(stackContainer)

    // -- -- Node header (name + opts button)

    nodeHeader = $('<div>', { class: 'red-ui-palette-header red-ui-info-header' })
      .css({ flex: '0 0 auto' })
      .appendTo(nodePanel)

    $('<span id="zwave-js-selected-node-id">').appendTo(nodeHeader)
    $('<span id="zwave-js-selected-node-name">').appendTo(nodeHeader)

    $('<button>')
      .addClass('red-ui-button red-ui-button-small')
      .css({ float: 'right' })
      .html('Show Node Options')
      .click(function () {
        if (nodeOpts.is(':visible')) {
          cancelSetName()
          $(this).html('Show Node Options')
          nodeOpts.hide()
        } else {
          $(this).html('Hide Node Options')
          nodeOpts.show()
        }
      })
      .appendTo(nodeHeader)

    // -- -- -- Node options

    let nodeOpts = $('<div>').appendTo(nodeHeader).hide()

    // -- -- -- -- Node info

    $('<div id="zwave-js-selected-node-info">').addClass('zwave-js-info-box').appendTo(nodeOpts)

    // -- -- -- -- Set name

    let rename = $('<div>').appendTo(nodeOpts)
    $('<input>').addClass('red-ui-searchBox-input').hide().appendTo(rename)
    $('<button id="zwave-js-set-node-name">')
      .addClass('red-ui-button red-ui-button-small')
      .html('Set Name')
      .click(function () {
        let input = $(this).prev()
        if (input.is(':visible')) {
          controllerRequest({
            class: 'Controller',
            operation: 'SetNodeName',
            params: [selectedNode, input.val()]
          }).then(({ node, object }) => {
            // `object` is actually a string with the new name
            // (should be the same as input.val(), but let's be sure)
            $('#zwave-js-node-list')
              .find(`[data-nodeid='${node}'] .zwave-js-node-row-name`)
              .html(object)
            if (node == selectedNode) $('#zwave-js-selected-node-name').text(object)
          })
          input.hide()
          $(this).html('Set Name')
        } else {
          input.show()
          input.val($('#zwave-js-selected-node-name').text())
          $(this).html('Go')
        }
      })
      .appendTo(rename)

    // -- -- -- -- Interview node

    let optInterview = $('<div>').appendTo(nodeOpts)
    $('<button>')
      .addClass('red-ui-button red-ui-button-small')
      .html('Interview Node')
      .click(() => {
        $('#zwave-js-status-box-interview').text('...')
        controllerRequest({
          class: 'Controller',
          operation: 'InterviewNode',
          params: [+selectedNode]
        }).catch(err => alert(err.responseText))
      })
      .appendTo(optInterview)
    $('<span id="zwave-js-status-box-interview">')
      .addClass('zwave-js-status-box')
      .appendTo(optInterview)

    // -- -- -- -- Remove failed node

    $('<div>')
      .appendTo(nodeOpts)
      .append(
        $('<button>')
          .addClass('red-ui-button red-ui-button-small')
          .html('Remove Failed Node')
          .click(() =>
            confirm('Are you sure you want to remove this node?', () => {
              controllerRequest({
                class: 'Controller',
                operation: 'RemoveFailedNode',
                params: [selectedNode],
                noWait: false
              })
              selectNode(1)
            })
          )
      )

    // -- -- -- -- Refresh property list

    $('<div>')
      .appendTo(nodeOpts)
      .append(
        $('<button>')
          .addClass('red-ui-button red-ui-button-small')
          .html('Refresh Property List')
          .click(() => getProperties())
      )

    // -- -- -- -- View in config db

    $('<button>')
      .addClass('red-ui-button red-ui-button-small')
      .html('View in Config Database')
      .click(() => {
        let info = $(`.zwave-js-node-row.selected`).data('info')?.deviceConfig || {}
        let id = [
          '0x' + info.manufacturerId.toString(16).padStart(4, '0'),
          info.devices[0].productType,
          info.devices[0].productId,
          info.firmwareVersion.min
        ].join(':')
        window.open(`https://devices.zwave-js.io/?jumpTo=${id}`, '_blank')
      })
      .appendTo(nodeOpts)

    // -- -- -- -- Filter by endpoint

    $('<div id="zwave-js-node-endpoint-filter">').appendTo(nodeOpts)

    // -- -- Node property list

    $('<div id="zwave-js-node-properties">')
      .css({ width: '100%', height: '100%' })
      .appendTo(nodePanel)
      .treeList({ data: [] })

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
      label: ' zwave-js',
      name: 'Z-Wave JS',
      content,
      enableOnEdit: true,
      iconClass: 'fa fa-feed',
      onchange: () => setTimeout(resizeStack, 0) // Only way I can figure out how to init the resize when tab becomes visible
    })

    // Get controller list

    getControllers()
  }
  // Init done

  function getControllers() {
    $.get('zwave-js/list').then(res => {
      $('#zwave-js-controller')
        .empty()
        .append(res.map(homeId => $(`<option value='${homeId}'>`).html(homeId)))
        .change()
    })
  }

  let selectedController

  function selectController(homeId) {
    deselectCurrentNode()
    RED.comms.unsubscribe(`/zwave-js/${selectedController}`, handleControllerEvent)
    selectedController = homeId
    getNodes()
    RED.comms.subscribe(`/zwave-js/${homeId}`, handleControllerEvent)
  }

  function handleControllerEvent(topic, data) {
    let homeId = topic.split('/')[2]
    if (selectedController != homeId) return

    switch (data.type) {
      case 'controller-event':
        let eventType = data.event.split(' ')[0]
        switch (eventType) {
          case 'inclusion':
          case 'exclusion':
          case 'heal':
            $(`#zwave-js-status-box-${eventType}`).text(data.event)
            break
          case 'node':
            // node added or removed; Refresh node list
            getNodes()
        }

        break
      case 'node-status':
        let nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${data.node}']`)
        if (data.status == 'ready') {
          // Ready
          nodeRow.find('.zwave-js-node-row-ready').html(renderReadyIcon(true))
        } else {
          // Normal status update
          nodeRow.find('.zwave-js-node-row-status').html(data.status.toUpperCase())
        }
        break
    }
  }

  function getNodes() {
    controllerRequest({
      class: 'Controller',
      operation: 'GetNodes'
    })
      .then(({ object }) => {
        let controllerNode = object.filter(N => N.isControllerNode)
        if (controllerNode.length > 0) {
          makeInfo('#zwave-js-controller-info', controllerNode[0].deviceConfig)
        }

        $('#zwave-js-node-list')
          .empty()
          .append(object.filter(node => node && !node.isControllerNode).map(renderNode))
      })
      .catch(console.error)
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

  function makeInfo(elId, deviceConfig = {}) {
    let el = $(elId)

    el.empty().append(
      $('<span>').text(`${deviceConfig.manufacturer} ${deviceConfig.label}`),
      $('<span>').text(`(${deviceConfig.description})`)
    )

    if (Object.keys(deviceConfig.metadata || {}).length) {
      let moreInfo = $('<dl>')
        .css({ whiteSpace: 'pre-wrap', width: '-webkit-fill-available' })
        .append(
          ...Object.entries(deviceConfig.metadata).map(([key, val]) => {
            return [
              $('<dt>').html(key),
              $('<dd>').html(
                val.replace(/http[^\s]*/g, url => `<a href="${url}">${url.slice(0, 30)}...</a>`)
              )
            ]
          })
        )
        .hide()

      let btn = $('<button>')
        .addClass('red-ui-button red-ui-button-small')
        .css({ position: 'absolute', right: 5 })
        .html('More Info')
        .click(function () {
          if ($(this).html() == 'More Info') {
            moreInfo.show()
            $(this).html('Less Info')
          } else {
            moreInfo.hide()
            $(this).html('More Info')
          }
        })

      el.append(btn, moreInfo)
    }
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
      RED.comms.unsubscribe(`/zwave-js/${selectedController}/${selectedNode}`, handleNodeEvent)
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
    $('#zwave-js-selected-node-name').text(info.name)
    makeInfo('#zwave-js-selected-node-info', info.deviceConfig)
    getProperties()
    RED.comms.subscribe(`/zwave-js/${selectedController}/${selectedNode}`, handleNodeEvent)
  }

  function handleNodeEvent(topic, data) {
    let nodeId = topic.split('/')[3]
    if (nodeId != selectedNode) return
    switch (data.type) {
      case 'node-interview':
        let statusBox = $('#zwave-js-status-box-interview')
        if (data.payload) {
          statusBox.text(data.payload.errorMessage)
        } else {
          statusBox.text('ready')
        }
        break
      case 'node-value':
        updateValue(data.payload)
        break
      case 'node-meta':
        updateMeta(data.payload, data.payload.metadata)
        break
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

    controllerRequest({
      node: selectedNode,
      class: 'Unmanaged',
      operation: 'GetDefinedValueIDs'
    }).then(({ object }) => buildPropertyTree(object))
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
          expanded: !AUTO_HIDE_CC.includes(commandClassName.replace(/\s/g, ' ')),
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
    // First get raw value
    controllerRequest({
      node: selectedNode,
      class: 'Unmanaged',
      operation: 'GetValue',
      params: [valueId]
    }).then(({ node, object: { valueId, response: value } }) => {
      if (node != selectedNode) return
      updateValue({ ...valueId, value })

      // Then get meta data which will:
      // 1. translate the value if possible
      // 2. add tooltips for references
      // 3. add edit options (if writable)
      controllerRequest({
        node: selectedNode,
        class: 'Unmanaged',
        operation: 'GetValueMetadata',
        params: [valueId]
      }).then(({ node, object: { valueId, response: meta } }) => {
        if (!meta) return
        if (node != selectedNode) return
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

            // Step 3: Send value change request and close editor
            controllerRequest({
              node: selectedNode,
              class: 'Unmanaged',
              operation: 'SetValue',
              params: [valueId, val],
              noWait: true
            })
            editor.remove()
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
      } else if (meta.type == 'number') {
        // NUMBER
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

  function controllerRequest(req) {
    return $.ajax({
      url: `zwave-js/${selectedController}`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(req),
      error: function (err) {
        alert(err.responseText)
      }
    })
  }

  return { init }
})()
