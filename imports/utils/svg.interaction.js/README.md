# svg.interaction.js

A library for svg.js handling interaction: draw, pan, drag, connect and drag-drop

Based on libraries:
* svg.pan.js - https://github.com/svgdotjs/svg.panzoom.js
* svg.draggable.js - https://github.com/svgdotjs/svg.draggable.js, https://github.com/jillix/svg.draggy.js/
* svg.connectable.js - https://github.com/loredanacirstea/svg.connectable.js, https://github.com/jillix/svg.connectable.js

## Install

 `npm i github:xz32/svg.interaction.js`
 
## Functionality
Handled in priority order: later has higher priority

### Draw
#### Methods
* drawable
    * true/false
#### Events
* drawbeforestart
* drawstart
* drawmove
* drawend

### Pan
#### Methods
* pannable
    * true/false
#### Events
* panbeforestart
* panstart
* panbeforemove
* panmove
* panend

### Drag
#### Methods
* draggable
    * true/false
#### Events
* dragbeforestart
* dragstart
* dragbeforemove
    * can override x, y to constraint
* dragmove
* dragend

### Connect
#### Methods
* connectTo
    * targetElement
* remove (on connector)
#### Events
* connectionadd
* connectionremove

### Drag Drop
#### Methods
* dragSource
    * true/group name/false
    * radius
* dropTarget
    * true/group name/false
    * radius
#### Events
* dragdropbeforestart
* dragdropstart
* dragdropbeforemove
* dragdropmove
* dragdropbeforedrop
* dragdropdrop