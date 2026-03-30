import type { Connection, Edge, EdgeChange, Node, NodeChange } from '@xyflow/react';

function insertAt<T>(items: T[], item: T, index?: number): T[] {
  if (index == null || index < 0 || index >= items.length) {
    return [...items, item];
  }

  return [...items.slice(0, index), item, ...items.slice(index)];
}

export function applyCanvasNodeChanges<NodeType extends Node = Node>(
  changes: NodeChange<NodeType>[],
  nodes: NodeType[]
): NodeType[] {
  let next = [...nodes];

  for (const change of changes) {
    switch (change.type) {
      case 'add':
        next = insertAt(next, change.item, change.index);
        break;
      case 'replace':
        next = next.map((node) => (node.id === change.id ? change.item : node));
        break;
      case 'remove':
        next = next.filter((node) => node.id !== change.id);
        break;
      case 'select':
        next = next.map((node) =>
          node.id === change.id ? { ...node, selected: change.selected } : node
        );
        break;
      case 'position':
        next = next.map((node) =>
          node.id === change.id
            ? {
                ...node,
                position: change.position ?? node.position,
                dragging: change.dragging ?? node.dragging,
              }
            : node
        );
        break;
      case 'dimensions':
        next = next.map((node) => {
          if (node.id !== change.id) {
            return node;
          }

          const measured = change.dimensions
            ? {
                width: change.dimensions.width ?? node.measured?.width,
                height: change.dimensions.height ?? node.measured?.height,
              }
            : node.measured;

          let width = node.width;
          let height = node.height;

          if (change.dimensions && change.setAttributes) {
            if (change.setAttributes === true || change.setAttributes === 'width') {
              width = change.dimensions.width ?? width;
            }
            if (change.setAttributes === true || change.setAttributes === 'height') {
              height = change.dimensions.height ?? height;
            }
          }

          return {
            ...node,
            measured,
            width,
            height,
            resizing: change.resizing ?? node.resizing,
          };
        });
        break;
    }
  }

  return next;
}

export function applyCanvasEdgeChanges<EdgeType extends Edge = Edge>(
  changes: EdgeChange<EdgeType>[],
  edges: EdgeType[]
): EdgeType[] {
  let next = [...edges];

  for (const change of changes) {
    switch (change.type) {
      case 'add':
        next = insertAt(next, change.item, change.index);
        break;
      case 'replace':
        next = next.map((edge) => (edge.id === change.id ? change.item : edge));
        break;
      case 'remove':
        next = next.filter((edge) => edge.id !== change.id);
        break;
      case 'select':
        next = next.map((edge) =>
          edge.id === change.id ? { ...edge, selected: change.selected } : edge
        );
        break;
    }
  }

  return next;
}

function buildConnectionEdgeId(connection: Connection): string {
  const parts = [
    connection.source,
    connection.sourceHandle ?? 'source',
    connection.target,
    connection.targetHandle ?? 'target',
  ];
  return `edge-${parts.join('-')}`;
}

export function addCanvasEdge<EdgeType extends Edge = Edge>(
  connection: Connection,
  edges: EdgeType[]
): EdgeType[] {
  const alreadyExists = edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (edge.sourceHandle ?? null) === connection.sourceHandle &&
      (edge.targetHandle ?? null) === connection.targetHandle
  );

  if (alreadyExists) {
    return edges;
  }

  const nextEdge = {
    id: buildConnectionEdgeId(connection),
    ...connection,
  } as EdgeType;

  return [...edges, nextEdge];
}
