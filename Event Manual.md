# node-red-contrib-zwave-js


### Event Manual  
The below table show the available events emitted by each node type.  
all evenst are wrapped in ```msg.payload```

The Controller Node
--------

```js
{
    event: 'ALL_NODES_READY'
    timestamp: 1234567890
}
```
```js
{
    event: '(INCLUSION | EXCLUSION)_(STARTED | STOPPED | FAILED)',
    eventBody: {
        inclusionStrategy: InclusionStrategy /* INCLUSION_STARTED only */
    },
    timestamp: 1234567890
}
```
```js
{
    event: 'REBUILD_ROUTES_(PROGRESS | DONE)'
    eventBody: RebuildRoutesStatus
    timestamp: 1234567890
}
```

The Device Node
--------
```js
{
    event: 'READY | ALIVE | WAKE_UP | SLEEP | DEAD',
    timestamp: 1234567890,
    nodeId: 99,
    nodeName: 'Foo',
    nodeLocation: 'Bar',
    eventBody: {
        oldStatus: PreviousStatus /* Excludes READY */
    }
}
```
```js
{
    event: 'VALUE_(NOTIFICATION | UPDATED | ADDED)',
    timestamp: 1234567890,
    nodeId: 99,
    nodeName: 'Foo',
    nodeLocation: 'Bar',
    eventBody: {
        valueId: ValueID,
        value: Any,     /* VALUE_NOTIFICATION only */
        newValue: Any,  /* VALUE_UPDATED, VALUE_ADDED only */
        prevValue: Any, /* VALUE_UPDATED only */
    }
}
```
```js
{
    event: 'NOTIFICATION',
    timestamp: 1234567890,
    nodeId: 99,
    nodeName: 'Foo',
    nodeLocation: 'Bar',
    eventBody: {
        ccId: 0x00,
        args: Any
    }
}
```


