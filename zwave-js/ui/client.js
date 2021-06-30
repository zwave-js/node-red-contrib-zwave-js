let ZwaveJsUI = (function () {

  function FirmwareUpdate(){
    let Options = {
      draggable: true,
      modal: true,
      resizable: true,
      width: '800',
      height: '600',
      title: "ZWave Device Firmware Updater",
      minHeight: 75,
      buttons: {
        Close: function () {
          $(this).dialog('destroy');
        }
      }
    }

    let Window = $('<div>').css({ padding: 10 }).html('Please wait...');
    Window.dialog(Options)

    ControllerCMD('Controller', 'GetNodes')
    .then(({ object }) => {

      let Table = $('<table>')

      let TR1 = $('<tr>').appendTo(Table);

      let TD1 = $('<td>Target Node</td>').appendTo(TR1);
      let TD2 = $('<td>').appendTo(TR1);
      let Select = $('<select>').appendTo(TD2);
      object.forEach((N) =>{
        if(N.isControllerNode){
          return
        }

        let Name = N.name ?? 'No Name'

        $('<option value="'+N.nodeId+'">'+N.nodeId+' - '+Name+'</option>').appendTo(Select)
      })

      Window.html('');
      Table.appendTo(Window)



    })
  }

  function NetworkMap() {

    let Options = {
      draggable: true,
      modal: true,
      resizable: true,
      width: '1024',
      height: '768',
      title: "ZWave Network Map. Routing is only an estimation. the signal quality also plays a part",
      minHeight: 75,
      buttons: {
        'Export Image': function () {

          let Map = $('#Network canvas')[0]
          Map.toBlob(function (blob) {
            var a = document.createElement("a");
            document.body.appendChild(a);
            a.download = "zwave-network" + ".png";
            a.href = window.URL.createObjectURL(blob);
            a.click();
          });

        },
        Close: function () {
          $(this).dialog('destroy');
        }
      }
    }

    let Window = $('<div>').css({ padding: 10 }).html('Generating Network Topology Map...');
    Window.dialog(Options)

    let Promises = [];
    let Nodes = []
    let Edges = []

    /* TEST START */
    let TestNodes = [{"nodeId":1,"name":"1 - Controller","isControllerNode":true,"isListening":false,"isRouting":false},{"nodeId":2,"name":"2 - Chandelier","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":3,"name":"3 - Family","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":4,"name":"4 - FamilyCan","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":5,"name":"5 - SmallBathLight","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":6,"name":"6 - SmallBathFan","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":7,"name":"7 - Zoey","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":8,"name":"8 - BedCeiling","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":9,"name":"9 - Sconce","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":10,"name":"10 - BathCeiling","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":11,"name":"11 - BigBathFan","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":12,"name":"12 - Mirror","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":13,"name":"13 - Closet","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":14,"name":"14 - Garage","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":15,"name":"15 - BackPorch","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":16,"name":"16 - Dining","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":17,"name":"17 - Island","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":18,"name":"18 - KitchenCan","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":19,"name":"19 - Sink","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":20,"name":"20 - Office","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":21,"name":"21 - Desk","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":22,"name":"22 - DownHall","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":23,"name":"23 - Living","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":24,"name":"24 - FrontPorch","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":25,"name":"25 - SmallBathWax","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":26,"name":"26 - StairsWax","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":27,"name":"27 - Laundry","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":28,"name":"28 - UpHall","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":29,"name":"29 - BedWax","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":30,"name":"30 - Hayley","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":31,"name":"31 - TheaterTheFan","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":32,"name":"32 - TheaterLight","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":33,"name":"33 - GirlsWax","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":34,"name":"34 - UpBathFan","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":35,"name":"35 - UpBathLight","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":36,"name":"36 - Playroom","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":37,"name":"37 - AtticLight","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":38,"name":"38 - Vanity","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":39,"name":"39 - ClosetMotion","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":40,"name":"40 - LaundryDoor","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":41,"name":"41 - TheaterMotion","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":42,"name":"42 - UpBathMotion","isControllerNode":false,"isListening":true,"isRouting":true},{"nodeId":43,"name":"43 - FrontDoor","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":44,"name":"44 - BackDoor","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":45,"name":"45 - GarageEntry","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":46,"name":"46 - GDGarrett","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":47,"name":"47 - GDHeidi","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":48,"name":"48 - FamilySmoke","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":49,"name":"49 - BathSmoke","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":50,"name":"50 - FrontSmoke","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":51,"name":"51 - No Name","isControllerNode":false,"isListening":false,"isRouting":false},{"nodeId":52,"name":"52 - No Name","isControllerNode":false,"isListening":false,"isRouting":false}]
    let TestNs = [{"node":1,"object":[3,6,7,8,9,10,11,14,15,16,17,18,19,20,21,23,24,25,28,29,30,31,32,33,34,35,36,37,38,39,40,41,43,44,45,46,48,49,50,51,52]},{"node":2,"object":[1,3,4,5,6,7,8,9,11,14,16,17,19,21,22,23,24,26,30,32,33,34,35,36,37,40,43,45,46,47,50,51,52]},{"node":3,"object":[1,2,4,5,6,8,9,10,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,32,33,34,35,37,38,40,43,44,45,46,47,48,49,50,51]},{"node":4,"object":[2,3,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,30,32,34,35,36,38,40,41,43,44,45,46,47,48,49,50,51]},{"node":5,"object":[1,2,3,4,6,7,8,9,10,11,12,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,33,34,35,36,37,38,39,40,41,42,43,45,46,47,48,49,50,51,52]},{"node":6,"object":[1,2,3,4,5,7,8,9,10,11,12,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,33,34,35,36,37,38,39,40,42,43,45,46,47,48,49,50,52]},{"node":7,"object":[1,2,3,4,5,6,8,9,10,11,12,14,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,40,41,45,46,47,48,49,50,51,52]},{"node":8,"object":[1,2,3,4,5,6,7,9,10,11,12,14,16,17,21,22,27,28,29,30,32,33,34,35,36,37,38,39,40,41,43,45,46,47,48,49,50,51,52]},{"node":9,"object":[1,2,3,4,5,6,7,8,10,11,12,13,14,16,18,21,23,25,26,27,28,29,30,31,32,33,35,36,37,38,40,41,43,45,46,47,48,49,50,51,52]},{"node":10,"object":[1,3,4,5,6,7,8,9,11,12,13,14,16,17,18,21,22,23,25,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52]},{"node":11,"object":[1,2,4,5,6,7,8,9,10,12,14,16,17,18,20,21,22,23,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,43,45,46,47,48,49,50,51,52]},{"node":12,"object":[1,3,5,6,7,8,9,10,11,13,14,16,17,18,19,21,22,23,25,26,27,28,29,30,31,32,34,35,36,37,38,39,40,41,43,46,47,48,49,51,52]},{"node":13,"object":[1,3,4,6,7,9,10,12,15,16,18,25,28,29,30,32,33,34,35,38,39,40,41,44,46,47,48,51]},{"node":14,"object":[1,2,3,4,5,6,7,8,9,10,11,12,15,16,17,18,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,52]},{"node":15,"object":[1,3,4,5,6,7,13,14,16,17,18,19,20,21,22,23,24,25,26,29,30,31,32,33,34,35,36,37,38,39,40,41,43,44,45,46,47,48,49,50,51,52]},{"node":16,"object":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,24,25,27,28,29,30,31,33,35,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52]},{"node":17,"object":[2,3,4,5,6,7,8,10,11,12,14,15,16,18,19,20,21,22,23,24,25,26,28,29,30,31,33,34,35,36,37,39,40,41,43,45,46,47,48,50,52]},{"node":18,"object":[1,3,4,5,6,7,9,10,11,12,13,14,15,16,17,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,41,42,43,45,46,47,48,49,50,52]},{"node":19,"object":[1,2,3,4,6,15,16,17,18,21,24,25,30,31,33,34,36,37,41,45,46,48,49,50,52]},{"node":20,"object":[1,3,4,5,6,7,14,15,16,17,18,21,22,23,24,25,30,32,33,35,36,40,41,43,45,46,47,48,50,52]},{"node":21,"object":[1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20,22,23,24,25,26,28,30,31,32,33,34,35,36,37,38,40,41,43,44,45,46,47,48,49,50,52]},{"node":22,"object":[1,2,3,4,5,6,7,8,10,11,12,14,15,16,17,18,20,21,23,24,26,27,28,29,30,32,33,34,35,36,37,38,40,41,43,45,46,48,49,50,52]},{"node":23,"object":[1,2,3,4,5,6,7,9,10,11,12,14,15,16,17,18,20,21,22,24,26,28,29,30,31,32,33,34,35,36,37,38,40,41,44,45,46,47,48,49,50,52]},{"node":24,"object":[1,2,3,4,5,6,7,14,15,16,17,18,19,20,21,22,23,25,26,27,29,30,31,33,34,35,36,37,40,41,43,44,45,46,47,48,49,50,52]},{"node":25,"object":[1,3,4,5,6,7,9,10,11,12,14,15,16,17,18,19,20,21,23,24,26,27,30,32,33,34,35,36,37,40,41,43,45,46,47,48,49,52]},{"node":26,"object":[2,3,4,5,6,7,9,11,12,14,15,18,21,22,23,24,25,29,30,31,34,35,36,37,40,43,45,46,47,48,49]},{"node":27,"object":[1,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,22,24,25,28,29,30,31,32,33,34,35,36,37,38,39,40,41,43,45,46,47,48,49,51,52]},{"node":28,"object":[1,3,4,5,6,7,8,9,10,11,12,13,14,16,17,18,22,27,29,30,32,33,34,35,36,37,38,39,40,41,43,45,46,47,48,49]},{"node":29,"object":[1,2,3,5,6,7,8,9,10,11,12,13,14,16,17,18,22,23,24,26,27,28,30,31,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52]},{"node":30,"object":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,31,33,34,35,36,37,38,39,40,41,44,45,46,47,48,50,51,52]},{"node":31,"object":[1,5,7,9,10,11,12,14,15,16,17,18,19,21,23,24,25,27,29,30,32,33,34,35,36,37,40,41,43,44,45,47,49,50,52]},{"node":32,"object":[1,2,3,4,7,8,9,10,11,12,13,14,15,17,18,20,21,22,23,27,28,31,33,34,35,36,37,39,40,41,43,44,45,47,48,49,50,51,52]},{"node":33,"object":[1,2,3,5,6,7,8,9,11,14,16,17,18,19,20,21,22,23,24,25,27,28,29,30,31,32,34,35,36,37,41,42,43,45,46,47,49,50,52]},{"node":34,"object":[1,2,3,4,5,7,8,10,11,12,13,14,15,17,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,35,36,37,38,39,40,41,42,43,45,46,47,48,49,50,51,52]},{"node":35,"object":[1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,18,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,36,37,38,39,40,41,42,43,45,47,48,49,50,52]},{"node":36,"object":[1,2,4,5,6,7,8,9,10,11,12,14,15,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,37,40,41,42,43,45,46,47,48,49,50,52]},{"node":37,"object":[1,2,3,5,6,7,8,9,10,11,12,14,15,16,17,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,38,39,40,42]},{"node":38,"object":[1,3,4,5,7,8,9,10,11,12,13,14,15,16,21,22,23,27,28,29,30,34,35,37,39,40]},{"node":39,"object":[1,3,5,6,7,8,9,10,11,12,13,14,15,16,25,27,28,29,30,31,32,34,35,37,38]},{"node":40,"object":[1,2,3,4,5,6,8,9,10,11,12,13,14,15,16,17,18,20,21,22,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38]},{"node":41,"object":[1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,19,20,21,23,24,26,27,28,29,30,31,32,33,34,35,36,37,42]},{"node":42,"object":[1,5,6,16,33,34,35,36,37,41]},{"node":43,"object":[1,2,3,4,5,7,8,9,10,11,12,14,15,16,17,18,20,21,22,23,24,26,27,28,29,31,32,33,34,35,36,37]},{"node":44,"object":[1,3,4,5,6,7,14,15,16,17,18,21,23,24,26,29,30,31,32,35,37]},{"node":45,"object":[1,2,3,4,5,6,7,8,9,10,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,42]},{"node":46,"object":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,33,35,36,37,38]},{"node":47,"object":[1,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,23,24,25,26,27,28,29,30,31,32,34,35,36,37,38,42]},{"node":48,"object":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,32,33,34,35,36,37,38]},{"node":49,"object":[1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,18,19,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,42]},{"node":50,"object":[1,2,3,4,5,6,7,8,9,11,14,16,17,18,19,20,21,22,23,24,25,26,27,29,30,31,32,33,34,35,36,37,42]},{"node":51,"object":[1,2,3,4,5,7,8,9,10,11,12,13,14,15,16,18,27,30,32,34,37]},{"node":52,"object":[1,2,5,6,7,8,9,10,11,12,15,16,17,18,19,20,21,22,23,24,25,26,27,29,31,32,33,34,35,36,37,42]}]


    TestNodes.forEach((N) => {

      let Name = N.isControllerNode ? 'Controller' : N.nodeId+' - ' + (N.name ?? 'No Name')
      let Shape = N.isControllerNode ? 'box' : 'square' 
      var Color = (N.isListening && N.isRouting) ? 'limegreen' : 'orangered'

      if(N.isControllerNode){
        Color = 'lightgray'
      }
      let ND = {
        id: N.nodeId,
        label: Name,
        shape:Shape,
        color:{
          background:Color,
          borderColor:'black',
          highlight:Color
        }
      }
      Nodes.push(ND)
    })


    TestNs.forEach(({node,object}) =>{

      if(TestNodes.filter((TN) =>TN.nodeId === node)[0].isControllerNode){
        return
      }

      object.forEach((NN) => {

        let Neighbor = TestNodes.filter((NID) => NID.nodeId === NN)[0];
        if ((Neighbor.isListening && Neighbor.isRouting) || Neighbor.isControllerNode) {
          let AlreadyAttached = Edges.filter((E) => E.from === NN && E.to === node)
          if (AlreadyAttached.length < 1) {

            let Color = {
              highlight: NN === 1 ? 'green' : '#000000',
              color:'#d3d3d3'
            }
            Edges.push({color:Color, from: node, to: NN, arrows: { to: { enabled: true, type: 'arrow' } } })
            
          } else {
            Edges.filter((E) => E.from === NN && E.to === node)[0].arrows.from = { enabled: true, type: 'arrow' }
          }
        }
      })
    })

    let data = {
      nodes: new vis.DataSet(Nodes),
      edges: new vis.DataSet(Edges)
    }
    let options = {
      nodes: {
        size: 8,
        font: {
          size: 8,
        },
        borderWidth:1,
        shadow:true,
      },
      edges:{
        shadow:false,
        width:0.15,
        length: 600,
        smooth: {
          type: "discrete",
        },
        physics:true
      },
      physics: {
        enabled: false,
        solver: "repulsion",
        repulsion: {
          nodeDistance: 600 // Put more distance between the nodes.
        }
      }
    }

    let VIS = $('<div>').css({width:'100%', height:'100%'}).attr('id','Network');
    Window.html('');
    VIS.appendTo(Window)
    let network = new vis.Network(VIS[0], data, options);

    network.stabilize()

    


    return;

    /* TEST END */


    ControllerCMD('Controller', 'GetNodes')
      .then(({ object }) => {

        let _Nodes = object;

        // Nodes
        _Nodes.forEach((N) => {

          let Name = N.isControllerNode ? 'Controller' : N.nodeId+' - ' + (N.name ?? 'No Name')
          let Shape = N.isControllerNode ? 'box' : 'square' 
          var Color = (N.isListening && N.isRouting) ? 'limegreen' : 'orangered'

          if(N.isControllerNode){
            Color = 'lightgray'
          }
          let ND = {
            id: N.nodeId,
            label: Name,
            shape:Shape,
            color:{
              background:Color,
              borderColor:'black',
              highlight:Color
            }
          }
          Nodes.push(ND)
        })

        // Neigbhours
        _Nodes.forEach((N) => {
          if (N.isControllerNode) {
            return
          }
          let P = new Promise((res, rej) => {
            ControllerCMD('Controller', 'GetNodeNeighbors', [N.nodeId])
              .then(({ node, object }) => {
                object.forEach((NN) => {

                  let Neighbor = _Nodes.filter((NID) => NID.nodeId === NN)[0];
                  if ((Neighbor.isListening && Neighbor.isRouting) || Neighbor.isControllerNode) {
                    let AlreadyAttached = Edges.filter((E) => E.from === NN && E.to === node)
                    if (AlreadyAttached.length < 1) {

                      let Color = {
                        highlight: NN === 1 ? 'green' : '#000000',
                        color:'#d3d3d3'
                      }
                      Edges.push({color:Color, from: node, to: NN, arrows: { to: { enabled: true, type: 'arrow' } } })
                    } else {
                      Edges.filter((E) => E.from === NN && E.to === node)[0].arrows.from = { enabled: true, type: 'arrow' }
                    }
                  }
                })
                res();
              })
          })
          Promises.push(P)
        })

        // All done - Generate Network map
        Promise.all(Promises)
          .then(() => {

            let data = {
              nodes: new vis.DataSet(Nodes),
              edges: new vis.DataSet(Edges)
            }
            let options = {
              nodes: {
                size: 8,
                font: {
                  size: 8,
                },
                borderWidth:1,
                shadow:true,
              },
              edges:{
                shadow:false,
                width:0.15,
                length: 600,
                smooth: {
                  type: "discrete",
                },
                physics:true
              },
              physics: {
                enabled: false,
                solver: "repulsion",
                repulsion: {
                  nodeDistance: 600 // Put more distance between the nodes.
                }
              }
            }

            let VIS = $('<div>').css({width:'100%', height:'100%'});
            Window.html('');
            VIS.appendTo(Window)
            let network = new vis.Network(VIS[0], data, options);

            network.stabilize()

          })

      })
  }

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

  /*
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
            $(this).dialog('destroy')
            onYes?.()
          },
          Cancel: function () {
            $(this).dialog('destroy')
            onCancel?.()
          }
        }
      })
  }

  function confirminclude(text, onYes, onCancel) {
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
          'Yes (Secure)': function () {
            $(this).dialog('destroy')
            onYes?.(false)
          },
          'Yes (Insecure)': function () {
            $(this).dialog('destroy')
            onYes?.(true)
          },
          Cancel: function () {
            $(this).dialog('destroy')
            onCancel?.()
          }
        }
      })
  }
  */

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

  function ControllerCMD(cls, op, params, dontwait) {

    let Options = {
      url: `zwave-js/cmd`,
      method: 'POST',
      contentType: 'application/json',
    }

    let Payload = {
      class: cls,
      operation: op
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

  function getNodes() {

    ControllerCMD('Controller', 'GetNodes')
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
        ControllerCMD('Controller', 'StartInclusion', [false], true)
      },
      'Yes (Insecure)': function () {
        ControllerCMD('Controller', 'StartInclusion', [true], true)
      }
    }
    modalPrompt('Begin the include process?', 'Include Mode', Buttons, true)
  }

  function StopInclude() {
    ControllerCMD('Controller', 'StopInclusion', [], true)
  }

  function StartExclude() {
    ControllerCMD('Controller', 'StartExclusion', [], true)
  }

  function StopExclude() {
    ControllerCMD('Controller', 'StopExclusion', [], true)
  }

  function Reset() {
    let Buttons = {
      'Yes - Reset': function () {
        ControllerCMD('Controller', 'Reset')
          .then(() => {
            modalAlert('Your Controller has been reset.', 'Reset Complete')
            getNodes();
          })
      }
    }
    modalPrompt('Are you sure you wish to reset your Controller? This action is irreversible, and will clear the Controllers data and configuration.', 'Reset Controller', Buttons, true)
  }

  function RenameNode() {

    let input = $(this).prev()
    if (input.is(':visible')) {
      ControllerCMD('Controller', 'SetNodeName', [selectedNode, input.val()])
        .then(({ node, object }) => {
          $('#zwave-js-node-list').find(`[data-nodeid='${node}'] .zwave-js-node-row-name`).html(object)
          if (node == selectedNode) {
            $('#zwave-js-selected-node-name').text(object)
          }
          getNodes();
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
      ControllerCMD('Controller', 'SetNodeName', [selectedNode, input.val()])
        .then(({ node, object }) => {
          $('#zwave-js-node-list').find(`[data-nodeid='${node}'] .zwave-js-node-row-location`).html("(" + object + ")")
          if (node == selectedNode) {
            $('#zwave-js-selected-node-location').text(object)
          }
          getNodes();
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
    ControllerCMD('Controller', 'InterviewNode', [selectedNode])
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
        ControllerCMD('Controller', 'RemoveFailedNode', [selectedNode])
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
        ControllerCMD('Controller', 'RemoveFailedNode', [selectedNode, false])
          .catch((err) => {
            if (err.status !== 504) {
              modalAlert(err.responseText, 'Could Not Replace Node')
            }
          })
      },
      'Yes (Insecure)': function () {
        ControllerCMD('Controller', 'RemoveFailedNode', [selectedNode, true])
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
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Start Network Heal').appendTo(optHeal)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Stop Network Heal').appendTo(optHeal)

    // Refresh, Reset
    let optRefreshReset = $('<div>').css('text-align', 'center').appendTo(controllerOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Refresh Node List').appendTo(optRefreshReset)
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
    $('<button>').addClass('red-ui-button red-ui-button-small').css({ float: 'right' }).html('Show Node Options').click(ShowHideNodeOptions).appendTo(nodeHeader)

    // node Options
    nodeOpts = $('<div>').appendTo(nodeHeader).hide()

    // Info
    $('<div id="zwave-js-selected-node-info">').addClass('zwave-js-info-box').appendTo(nodeOpts)

    // Rename
    let rename = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<input>').addClass('red-ui-searchBox-input').hide().appendTo(rename)
    $('<button id="zwave-js-set-node-name">').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Set Name').click(RenameNode).appendTo(rename)

    // Location
    let location = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<input>').addClass('red-ui-searchBox-input').hide().appendTo(location)
    $('<button id="zwave-js-set-node-location">').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Set Location').click(SetNodeLocation).appendTo(location)

    // Interview
    let optInterview = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Interview Node').click(InterviewNode).appendTo(optInterview)

    // Remove
    let RemoveFailed = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Remove Failed Node').click(RemoveFailedNode).appendTo(RemoveFailed)

    // Remove
    let ReplaceFailed = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Remove Failed Node').click(ReplaceFailedNode).appendTo(ReplaceFailed)


    // Refres Properties
    let RefresProps = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('Refresh Property List').click(getProperties).appendTo(RefresProps)

    // DB
    let DB = $('<div>').css('text-align', 'center').appendTo(nodeOpts)
    $('<button>').addClass('red-ui-button red-ui-button-small').css('min-width', '125px').html('View in Config Database').click(OpenDB).appendTo(DB)

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

    getNodes();

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
            getNodes()
        }
        break

      case 'node-status':
        let nodeRow = $('#zwave-js-node-list').find(`[data-nodeid='${data.node}']`)
        if (data.status == 'ready') {
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
          /* expanded: !AUTO_HIDE_CC.includes(commandClassName.replace(/\s/g, ' ')),*/
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
      url: `zwave-js/cmd`,
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(req)
    })
  }

  function getLatestStatus(req) {
    $.ajax({
      url: `zwave-js/fetch-driver-status`,
      method: 'GET',
    })
  }

  return { init }
})()
