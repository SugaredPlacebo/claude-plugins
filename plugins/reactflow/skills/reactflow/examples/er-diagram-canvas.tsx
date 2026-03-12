/**
 * Complete ERD Canvas Setup
 *
 * Assembles all ER diagram components into a single React Flow canvas.
 * Uses ELK for auto-layout, with Dagre as an alternative (see comments).
 *
 * Required dependencies:
 *   npm install @xyflow/react elkjs
 *   # OR for Dagre alternative:
 *   npm install @xyflow/react @dagrejs/dagre
 *
 * Usage:
 *   <ERDCanvas schema={mySchema} />
 */

'use client'

import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'

// Prerequisites: Create these files using the patterns in the references/ directory.
// See references/er-diagram-types.md for Schema, ShowMode, convertSchemaToNodes
// See references/er-diagram-components.md for TableNode, RelationshipEdge, CardinalityMarkers
// See references/er-diagram-layout.md for computeAutoLayout, highlightNodesAndEdges
import { TableNode } from './TableNode'
import { NonRelatedTableGroupNode } from './NonRelatedTableGroupNode'
import { RelationshipEdge } from './RelationshipEdge'
import { CardinalityMarkers } from './CardinalityMarkers'
import { RelationshipEdgeParticleMarker } from './RelationshipEdgeParticleMarker'
import { convertSchemaToNodes } from './convertSchemaToNodes'
import { computeAutoLayout } from './computeAutoLayout'
import { highlightNodesAndEdges } from './highlightNodesAndEdges'
import type { Schema, ShowMode } from './types'

// ---------- Register custom types OUTSIDE the component ----------
const nodeTypes = {
  table: TableNode,
  nonRelatedTableGroup: NonRelatedTableGroupNode,
}

const edgeTypes = {
  relationship: RelationshipEdge,
}

// ---------- Show Mode Toggle ----------
function ShowModeToggle({
  value,
  onChange,
}: {
  value: ShowMode
  onChange: (mode: ShowMode) => void
}) {
  return (
    <div className="flex gap-1 bg-gray-800 rounded p-1">
      {(['TABLE_NAME', 'KEY_ONLY', 'ALL_FIELDS'] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`px-2 py-1 text-xs rounded ${
            value === mode ? 'bg-gray-600 text-white' : 'text-gray-400'
          }`}
        >
          {mode === 'TABLE_NAME' ? 'Compact' : mode === 'KEY_ONLY' ? 'Keys' : 'All'}
        </button>
      ))}
    </div>
  )
}

// ---------- Main ERD Canvas ----------
type Props = {
  schema: Schema
}

function ERDCanvas({ schema }: Props) {
  const [showMode, setShowMode] = useState<ShowMode>('ALL_FIELDS')
  const [activeTableName, setActiveTableName] = useState<string | undefined>()

  // Convert schema → nodes/edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => convertSchemaToNodes({ schema, showMode }),
    [schema, showMode],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Run auto-layout after initial render
  // Option A: ELK (async, needs measured dimensions)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { nodes: laid, edges: laidEdges } = await computeAutoLayout(nodes, edges)
      setNodes(laid)
      setEdges(laidEdges)
    }, 100)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Option B: Dagre (synchronous, simpler)
  // useEffect(() => {
  //   const laid = autoLayoutERDiagram(nodes, edges, { direction: 'LR' }, showMode)
  //   setNodes(laid)
  // }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Hover highlighting
  const handleMouseEnter: NodeMouseHandler = useCallback(
    (_, node) => {
      const { nodes: n, edges: e } = highlightNodesAndEdges(nodes, edges, {
        activeTableName,
        hoverTableName: node.id,
      })
      setNodes(n)
      setEdges(e)
    },
    [nodes, edges, activeTableName],
  )

  const handleMouseLeave: NodeMouseHandler = useCallback(() => {
    const { nodes: n, edges: e } = highlightNodesAndEdges(nodes, edges, {
      activeTableName,
      hoverTableName: undefined,
    })
    setNodes(n)
    setEdges(e)
  }, [nodes, edges, activeTableName])

  // Click selection
  const handleNodeClick = useCallback(
    (_: any, node: Node) => {
      setActiveTableName(node.id)
      const { nodes: n, edges: e } = highlightNodesAndEdges(nodes, edges, {
        activeTableName: node.id,
      })
      setNodes(n)
      setEdges(e)
    },
    [nodes, edges],
  )

  const handlePaneClick = useCallback(() => {
    setActiveTableName(undefined)
    const { nodes: n, edges: e } = highlightNodesAndEdges(nodes, edges, {})
    setNodes(n)
    setEdges(e)
  }, [nodes, edges])

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      {/* SVG markers must be rendered outside ReactFlow */}
      <CardinalityMarkers />
      <RelationshipEdgeParticleMarker />

      {/* Show mode controls */}
      <div className="absolute top-4 left-4 z-10">
        <ShowModeToggle value={showMode} onChange={setShowMode} />
      </div>

      <ReactFlowProvider>
        <ReactFlow
          colorMode="dark"
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeMouseEnter={handleMouseEnter}
          onNodeMouseLeave={handleMouseLeave}
          panOnScroll
          panOnDrag={[1, 2]}
          minZoom={0.1}
          maxZoom={2}
          nodesConnectable={false} // ER diagrams are read-only
          edgesFocusable={false}
          edgesReconnectable={false}
          deleteKeyCode={null} // prevent accidental deletion
          fitView
        >
          <Background
            color="var(--color-gray-600)"
            variant={BackgroundVariant.Dots}
            size={1}
            gap={16}
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

export default ERDCanvas
