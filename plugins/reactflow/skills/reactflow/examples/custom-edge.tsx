// Custom edge pattern — edge with a label rendered via EdgeLabelRenderer
// Register in edgeTypes OUTSIDE the component that renders <ReactFlow />

import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
} from '@xyflow/react';
// Also available: getBezierPath, getSmoothStepPath, getSimpleBezierPath

export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: '#fff',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// Register edgeTypes OUTSIDE the component (same pattern as nodeTypes)
export const edgeTypes = {
  labeled: LabeledEdge,
};

// Edge data shape:
// {
//   id: 'e1-2',
//   type: 'labeled',            // must match a key in edgeTypes
//   source: 'node1',
//   target: 'node2',
//   label: 'connects to',
// }
