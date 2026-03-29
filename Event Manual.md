# node-red-contrib-zwave-js


### Event Manual  
The below table show the available events emitted by each node type.  
all events are wrapped in ```payload```

The Controller Node
--------

```js
{
    event: 'ALL_NODES_READY',
    timestamp: number
}
```
```js
{
    event: 'NODE_(ADDED | REMOVED)',
    timestamp: number,
    eventBody:{
        nodeId: number,
        lowSecurity: boolean, /* NODE_ADDED only */
        reason: Reason        /* NODE_REMOVED only */
    }
}
```
```js
{
    event: 'INTERVIEW_(STARTED | COMPLETED | FAILED)',
    timestamp: number,
    eventBody:{
        nodeId: number,
        args: InterviewFailedEventArgs /* INTERVIEW_FAILED only */
    }
}
```
```js
{
    event: '(INCLUSION | EXCLUSION)_(STARTED | STOPPED | FAILED)',
    timestamp: number,
    eventBody: {
        inclusionStrategy: InclusionStrategy /* INCLUSION_STARTED only */
    }
}
```
```js
{
    event: 'REBUILD_ROUTES_(PROGRESS | DONE)',
    timestamp: number,
    eventBody: RebuildRoutesStatus

}
```

The Device Node
--------
```js
{
    event: 'READY | ALIVE | WAKE_UP | SLEEP | DEAD',
    timestamp: number,
    nodeId: number,
    nodeName: string,
    nodeLocation: string,
    eventBody: {
        oldStatus: PreviousStatus /* Excludes READY */
    }
}
```
```js
{
    event: 'VALUE_(NOTIFICATION | UPDATED | ADDED)',
    timestamp: number,
    nodeId: number,
    nodeName: string,
    nodeLocation: string,
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
    timestamp: number,
    nodeId: number,
    nodeName: string,
    nodeLocation: string,
    eventBody: {
        ccId: number,
        args: Any
    }
}
```


