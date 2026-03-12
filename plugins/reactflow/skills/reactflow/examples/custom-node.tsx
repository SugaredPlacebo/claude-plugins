// Custom node pattern — ProcessNode with typed data, handles, and selection styling
// Register in nodeTypes OUTSIDE the component that renders <ReactFlow />

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';

// 1. Type the node data shape
type ProcessNodeData = {
  label: string;
  description?: string;
};

// 2. Create the full node type (used for nodeTypes registration and NodeProps generic)
export type ProcessNode = Node<ProcessNodeData, 'process'>;

// 3. Build the component — ReactFlow injects id, data, selected, etc.
export function ProcessNode({ data, selected }: NodeProps<ProcessNode>) {
  return (
    <div
      style={{
        padding: '10px 16px',
        border: `2px solid ${selected ? '#1a73e8' : '#ddd'}`,
        borderRadius: 8,
        background: '#fff',
        minWidth: 150,
      }}
    >
      {/* Target handle — where incoming edges connect */}
      <Handle type="target" position={Position.Top} />

      <div style={{ fontWeight: 600 }}>{data.label}</div>
      {data.description && (
        <div style={{ fontSize: 12, color: '#666' }}>{data.description}</div>
      )}

      {/* Source handle — where outgoing edges start */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

// 4. Register nodeTypes OUTSIDE the component (or with useMemo)
//    This object must be stable — defining it inline causes infinite re-renders
export const nodeTypes = {
  process: ProcessNode,
};

// 5. Node data shape for the nodes array:
// {
//   id: '1',
//   type: 'process',           // must match a key in nodeTypes
//   position: { x: 0, y: 0 },
//   data: { label: 'Step 1', description: 'Does X' },
// }
