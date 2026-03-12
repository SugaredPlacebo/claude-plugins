---
name: reactflow
description: >
  This skill should be used whenever implementing React Flow (@xyflow/react v12+)
  in a React or Next.js project. Relevant scenarios include: building node-based UIs,
  flow editors, workflow diagrams, canvas-based graphs, DAG visualizations, or any
  feature involving draggable nodes and edges. Should also be triggered by mentions of
  "reactflow", "react flow", "xyflow", custom nodes, handles, edges, or graph canvas
  components. The library has specific component and hook patterns (nodeTypes
  memoization, Handle components, container sizing) that cause silent bugs and
  infinite re-renders if not followed.
---

# ReactFlow Skill

Import all ReactFlow components from `@xyflow/react` (v12+).

> **Version note:** Projects using the older `reactflow` package (v11) have a different import path. Check `package.json` before writing imports — if `reactflow` is installed, import from `reactflow` not `@xyflow/react`.

## Critical Rules (Read First)

1. **Never handcraft node HTML without `<Handle />`** — connections require ReactFlow's `<Handle />` component, not raw divs.
2. **Always define `nodeTypes` and `edgeTypes` outside the component** or with `useMemo`. Defining them inline causes infinite re-renders.
3. **Always define event handlers with `useCallback`** or outside the component for the same reason.
4. **The `<ReactFlow />` container must have an explicit width and height** (via CSS or inline style). Without dimensions, nothing renders.
5. **Always import the base stylesheet**: `import '@xyflow/react/dist/style.css'`.
6. **`useReactFlow()` only works inside a child of `<ReactFlow />` or `<ReactFlowProvider />`** — never call it in the same component that renders `<ReactFlow />`.
7. **Always pass `onNodesChange` and `onEdgesChange` to `<ReactFlow />`** when using controlled state (`useNodesState` / `useEdgesState`). Without them, nodes appear frozen (un-draggable, un-selectable) with zero errors.

---

## Installation

```bash
npm install @xyflow/react
```

---

## Minimal Controlled Flow

Set up a controlled flow canvas with interactive nodes. See `examples/minimal-flow.tsx` for the full working example.

Key pattern:
```tsx
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

const onConnect: OnConnect = useCallback(
  (connection) => setEdges((eds) => addEdge(connection, eds)),
  [setEdges]
);
```

Pass all six props to `<ReactFlow>`: `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect`, and `fitView`.

---

## Custom Nodes

Define a React component accepting `NodeProps`, add `<Handle />` components for connection points, and register it in `nodeTypes` outside the parent component. See `examples/custom-node.tsx` for a complete ProcessNode implementation.

Key requirements:
- Type the node data shape: `type MyNode = Node<MyData, 'myType'>`
- Accept `NodeProps<MyNode>` as the component prop type
- Include at least one `<Handle type="target" />` and one `<Handle type="source" />`
- Register: `const nodeTypes = { myType: MyNodeComponent }` — **outside** the component body

---

## Handles — Connection Points

```tsx
import { Handle, Position } from '@xyflow/react';

// Single source + target (most common)
<Handle type="target" position={Position.Top} />
<Handle type="source" position={Position.Bottom} />

// Multiple handles — requires unique `id` per handle
<Handle type="source" position={Position.Right} id="right-out" />
<Handle type="source" position={Position.Bottom} id="bottom-out" />
```

Handle positions: `Position.Top | Position.Bottom | Position.Left | Position.Right`

Connect an edge to a specific handle:
```ts
{ id: 'e1', source: 'node1', sourceHandle: 'right-out', target: 'node2', targetHandle: 'left-in' }
```

**Hide handles** with `visibility: hidden` or `opacity: 0` — never `display: none` (breaks connection detection).

**Interactive elements inside nodes** (buttons, inputs) need `className="nodrag"` to prevent the drag handler from capturing clicks:
```tsx
<button className="nodrag" onClick={handleClick}>Click me</button>
<input className="nodrag nopan" onChange={handleChange} />
```

---

## Updating Node Data from Inside a Node

Use `updateNodeData` from `useReactFlow()`:

```tsx
const { updateNodeData } = useReactFlow();
// updateNodeData merges by default — no need to spread existing data
updateNodeData(id, { count: data.count + 1 });
```

Do **not** bind `data` directly to input `value` (causes cursor jumps). Use local `useState` and sync on blur/submit.

---

## Custom Edges

Define a component using `BaseEdge`, `EdgeLabelRenderer`, and a path function (`getStraightPath`, `getBezierPath`, `getSmoothStepPath`). Register in `edgeTypes` outside the component, same pattern as `nodeTypes`. See `examples/custom-edge.tsx` for a complete implementation.

---

## useReactFlow — Imperative Control

Must be called inside a child of `<ReactFlow />` or `<ReactFlowProvider />`. For the full API surface, see `references/use-react-flow-api.md`.

Common operations:
```tsx
const { addNodes, deleteElements, fitView, toObject, updateNodeData } = useReactFlow();
```

When the toolbar/controls live in the same component as `<ReactFlow />`, wrap with `<ReactFlowProvider>`:
```tsx
<ReactFlowProvider>
  <FlowCanvas />   {/* renders <ReactFlow> */}
  <Toolbar />      {/* uses useReactFlow() */}
</ReactFlowProvider>
```

---

## Next.js Specifics

All ReactFlow components require Client Components (`'use client'` at top of file). For hydration issues with App Router, use dynamic import with `ssr: false`. See `references/nextjs-setup.md` for details.

---

## Common Pitfalls

| Problem | Cause | Fix |
|---|---|---|
| Infinite re-render loop | `nodeTypes` / `edgeTypes` / handlers defined inline | Move outside component or wrap with `useMemo` / `useCallback` |
| Canvas is blank | Container has no height | Add explicit `height` to wrapper div |
| Nodes won't drag or select | Missing `onNodesChange` / `onEdgesChange` | Pass both callbacks from `useNodesState` / `useEdgesState` |
| Nodes render but nothing connects | Missing `<Handle />` in custom node | Add `<Handle type="source/target" position={...} />` |
| `useReactFlow` throws | Called in same component as `<ReactFlow />` | Add `<ReactFlowProvider>` wrapper or move hook to child |
| Clicks not registering on node content | Drag handler intercepts | Add `className="nodrag"` to interactive elements |
| Handle `display:none` breaks connections | ReactFlow can't measure hidden handles | Use `visibility: hidden` instead |
| Styles missing | CSS not imported | Add `import '@xyflow/react/dist/style.css'` |

---

## Key Imports

For the full categorized import reference, see `references/imports.md`.

---

## Further Reference

For advanced topics not covered here, consult https://reactflow.dev:
- Layouting (Dagre, ELK): `/learn/layouting/layouting`
- Sub-flows / node groups: `/learn/layouting/sub-flows`
- State management with Zustand: `/learn/advanced-use/state-management`
- TypeScript guide: `/learn/advanced-use/typescript`
