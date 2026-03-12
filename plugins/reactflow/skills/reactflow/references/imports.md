# ReactFlow Import Reference

All imports from `@xyflow/react` (v12+). For v11 projects, import from `reactflow` instead.

```tsx
// Always required
import '@xyflow/react/dist/style.css';

// Core components
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';

// State hooks (controlled flow)
import { useNodesState, useEdgesState } from '@xyflow/react';

// Imperative control (must be inside ReactFlow/ReactFlowProvider child)
import { useReactFlow } from '@xyflow/react';

// Node building blocks
import { Handle, Position, NodeToolbar, NodeResizer } from '@xyflow/react';

// Edge building blocks
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  getBezierPath,
  getSmoothStepPath,
  getSimpleBezierPath,
} from '@xyflow/react';

// Built-in UI panels
import { Background, Controls, MiniMap, Panel } from '@xyflow/react';

// Utility functions
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';

// Types
import type {
  Node,
  Edge,
  NodeProps,
  EdgeProps,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  Connection,
  FitViewOptions,
  DefaultEdgeOptions,
  NodeTypes,
  EdgeTypes,
} from '@xyflow/react';
```

## Background Variants

```tsx
import { BackgroundVariant } from '@xyflow/react';

<Background variant={BackgroundVariant.Dots} />   // default
<Background variant={BackgroundVariant.Lines} />
<Background variant={BackgroundVariant.Cross} />
```

## MiniMap Customization

```tsx
<MiniMap
  nodeColor={(node) => {
    switch (node.type) {
      case 'input': return '#6C5CE7';
      case 'output': return '#00D4FF';
      default: return '#eee';
    }
  }}
  maskColor="rgba(0,0,0,0.2)"
  pannable
  zoomable
/>
```
