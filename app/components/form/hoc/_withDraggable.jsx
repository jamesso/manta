import React from 'react';
import { Draggable } from '@hello-pangea/dnd';

// Inputs inside a row stay usable: the library does not start a drag
// from input/textarea/select/button elements.
const _withDraggable = ComposedComponent => props => (
  <Draggable draggableId={props.item.id} index={props.index}>
    {provided => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...(provided.dragHandleProps || {})}
        style={{ ...provided.draggableProps.style, margin: '0 0 14px 0' }}
      >
        <ComposedComponent {...props} />
      </div>
    )}
  </Draggable>
);

export default _withDraggable;
