# useReactFlow API Reference

`useReactFlow()` provides imperative control over the flow instance. Must be called inside a child of `<ReactFlow />` or `<ReactFlowProvider />`.

## Node Operations

```tsx
const {
  getNodes,          // () => Node[] — get current nodes array
  getNode,           // (id: string) => Node | undefined
  setNodes,          // (nodes: Node[] | (prev: Node[]) => Node[]) => void
  addNodes,          // (nodes: Node | Node[]) => void
  updateNode,        // (id: string, nodeUpdate: Partial<Node>) => void
  updateNodeData,    // (id: string, dataUpdate: object) => void — merges by default
} = useReactFlow();
```

## Edge Operations

```tsx
const {
  getEdges,          // () => Edge[]
  getEdge,           // (id: string) => Edge | undefined
  setEdges,          // (edges: Edge[] | (prev: Edge[]) => Edge[]) => void
  addEdges,          // (edges: Edge | Edge[]) => void
} = useReactFlow();
```

## Deletion

```tsx
const { deleteElements } = useReactFlow();

// Delete specific nodes (also removes connected edges automatically)
deleteElements({ nodes: [{ id: 'node-1' }] });

// Delete specific edges
deleteElements({ edges: [{ id: 'edge-1' }] });

// Delete both
deleteElements({
  nodes: [{ id: 'node-1' }],
  edges: [{ id: 'edge-2' }],
});
```

## Viewport Control

```tsx
const {
  fitView,           // (options?: FitViewOptions) => void
  zoomIn,            // (options?: { duration?: number }) => void
  zoomOut,           // (options?: { duration?: number }) => void
  zoomTo,            // (zoom: number, options?) => void
  setViewport,       // (viewport: { x, y, zoom }) => void
  getViewport,       // () => { x, y, zoom }
  setCenter,         // (x, y, options?) => void — center viewport on coordinates
  screenToFlowPosition, // (point: { x, y }) => { x, y } — convert screen coords to flow coords
  flowToScreenPosition, // (point: { x, y }) => { x, y } — convert flow coords to screen coords
} = useReactFlow();
```

## Serialization

```tsx
const { toObject } = useReactFlow();

// Returns { nodes, edges, viewport } — the full serializable state
const flowState = toObject();
localStorage.setItem('flow', JSON.stringify(flowState));
```

## Intersection & Connection Helpers

```tsx
const {
  getIntersectingNodes,  // (node: Node | Rect, partially?: boolean) => Node[]
  isNodeIntersecting,    // (node: Node | Rect, area: Rect, partially?: boolean) => boolean
  getConnectedEdges,     // (nodes: Node[]) => Edge[]
  getIncomers,           // (node: Node, nodes: Node[], edges: Edge[]) => Node[]
  getOutgoers,           // (node: Node, nodes: Node[], edges: Edge[]) => Node[]
} = useReactFlow();
```

## Common Patterns

### Add a node at the center of the viewport

```tsx
const addNodeAtCenter = useCallback(() => {
  const { x, y, zoom } = getViewport();
  const centerX = -x / zoom + window.innerWidth / 2 / zoom;
  const centerY = -y / zoom + window.innerHeight / 2 / zoom;

  addNodes({
    id: `node-${Date.now()}`,
    type: 'default',
    position: { x: centerX - 75, y: centerY - 25 },
    data: { label: 'New Node' },
  });
}, [addNodes, getViewport]);
```

### Save and restore flow state

```tsx
// Save
const onSave = useCallback(() => {
  const flow = toObject();
  localStorage.setItem('flow', JSON.stringify(flow));
}, [toObject]);

// Restore (in a useEffect or handler)
const onRestore = useCallback(() => {
  const saved = localStorage.getItem('flow');
  if (saved) {
    const { nodes, edges, viewport } = JSON.parse(saved);
    setNodes(nodes);
    setEdges(edges);
    setViewport(viewport);
  }
}, [setNodes, setEdges, setViewport]);
```
