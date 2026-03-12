# ER Diagram Layout, Show Modes & Highlighting

Reference for auto-layout (ELK and Dagre), show modes, and interactive highlighting in ER diagrams.

---

## Auto-Layout with ELK

ELK (Eclipse Layout Kernel) via `elkjs` provides a layered graph layout algorithm that positions table nodes to minimize edge crossings. Supports parent-child node grouping.

### Install

```bash
npm install elkjs
```

### Convert Nodes to ELK Format

```typescript
import type { Node } from '@xyflow/react'
import type { ElkNode } from 'elkjs'

function convertNodesToElkNodes(nodes: Node[]): ElkNode[] {
  const nodeMap: Record<string, ElkNode> = {}
  const elkNodes: ElkNode[] = []

  for (const node of nodes) {
    const elkNode: ElkNode = {
      ...node,
      width: node.measured?.width ?? 200,
      height: node.measured?.height ?? 100,
      layoutOptions: {
        'elk.aspectRatio': node.type === 'nonRelatedTableGroup' ? '0.5625' : '1.6f',
        'elk.alignment': 'LEFT',
      },
    }

    nodeMap[node.id] = elkNode

    if (node.parentId) {
      const parent = nodeMap[node.parentId]
      if (parent) {
        if (!parent.children) parent.children = []
        parent.children.push(elkNode)
      }
    } else {
      elkNodes.push(elkNode)
    }
  }

  return elkNodes
}
```

### Run ELK Layout

```typescript
import type { Edge, Node } from '@xyflow/react'
import type { ElkNode, LayoutOptions } from 'elkjs'
import ELK from 'elkjs/lib/elk.bundled.js'

const elk = new ELK()

const layoutOptions: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.layered.spacing.baseValue': '40',
  'elk.spacing.componentComponent': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '120',
  'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'true',
  'elk.layered.mergeEdges': 'true',
  'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
  'elk.layered.layering.strategy': 'INTERACTIVE',
}

async function getElkLayout({
  nodes,
  edges,
}: {
  nodes: Node[]
  edges: Edge[]
}): Promise<Node[]> {
  const graph: ElkNode = {
    id: 'root',
    layoutOptions,
    children: convertNodesToElkNodes(nodes),
    edges: edges.map(({ id, source, target }) => ({
      id,
      sources: [source],
      targets: [target],
    })),
  }

  const layout = await elk.layout(graph)
  if (!layout.children) return nodes

  return convertElkNodesToNodes(layout.children, nodes)
}
```

### Convert ELK Output Back to React Flow

```typescript
function convertElkNodesToNodes(elkNodes: ElkNode[], originNodes: Node[]): Node[] {
  const nodes: Node[] = []

  for (const elkNode of elkNodes) {
    const originNode = originNodes.find((n) => n.id === elkNode.id)
    if (!originNode) continue

    nodes.push({
      ...originNode,
      position: { x: elkNode.x ?? 0, y: elkNode.y ?? 0 },
      width: elkNode.width ?? 0,
      height: elkNode.height ?? 0,
    })

    if (elkNode.children) {
      nodes.push(...convertElkNodesToNodes(elkNode.children, originNodes))
    }
  }

  return nodes
}
```

### Orchestrator

```typescript
async function computeAutoLayout(nodes: Node[], edges: Edge[]) {
  const hiddenNodes: Node[] = []
  const visibleNodes: Node[] = []
  for (const node of nodes) {
    ;(node.hidden ? hiddenNodes : visibleNodes).push(node)
  }

  const nodeMap = new Map(visibleNodes.map((n) => [n.id, n]))
  const visibleEdges = edges.filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))

  const newNodes = await getElkLayout({ nodes: visibleNodes, edges: visibleEdges })
  return { nodes: [...hiddenNodes, ...newNodes], edges }
}
```

---

## Auto-Layout with Dagre (Alternative)

Dagre is a simpler, synchronous alternative to ELK.

### Comparison

| Feature | Dagre | ELK |
|---------|-------|-----|
| Algorithm | Hierarchical/layered | Layered + many strategies |
| Parent/child grouping | No native support | Full support |
| Execution | Synchronous | Async (web worker capable) |
| Bundle size | ~30KB | ~150KB |
| Configuration | Simple (rankdir, spacing) | 50+ layout options |
| Edge routing | Basic | Advanced (merge, bend points) |

**When to use Dagre:** Simpler setup, already installed, no parent-child grouping needed.
**When to use ELK:** Advanced edge routing, parent-child grouping, fine-grained layout control.

### Install

```bash
npm install @dagrejs/dagre
```

### ER Diagram Layout Function

```typescript
import Dagre from '@dagrejs/dagre'
import { Position, type Node, type Edge } from '@xyflow/react'

interface ERLayoutOptions {
  direction?: 'TB' | 'LR'
  nodeSpacing?: number
  rankSpacing?: number
}

const TABLE_HEADER_HEIGHT = 36
const COLUMN_ROW_HEIGHT = 28
const TABLE_MIN_WIDTH = 220
const TABLE_PADDING = 8

/**
 * Calculate table node dimensions dynamically based on column count and show mode.
 */
function getTableDimensions(
  node: Node,
  showMode: ShowMode = 'ALL_FIELDS',
): { width: number; height: number } {
  if (node.type !== 'table') {
    return { width: 180, height: 60 }
  }

  const table = (node.data as TableNodeData).table
  const columnCount = Object.keys(table.columns).length

  let visibleColumns: number
  switch (showMode) {
    case 'TABLE_NAME':
      visibleColumns = 0
      break
    case 'KEY_ONLY': {
      const constraints = table.constraints
      const pkColumns = new Set<string>()
      const fkColumns = new Set<string>()
      for (const c of Object.values(constraints)) {
        if (c.type === 'PRIMARY KEY') c.columnNames.forEach((n) => pkColumns.add(n))
        if (c.type === 'FOREIGN KEY') c.columnNames.forEach((n) => fkColumns.add(n))
      }
      visibleColumns = new Set([...pkColumns, ...fkColumns]).size
      break
    }
    case 'ALL_FIELDS':
    default:
      visibleColumns = columnCount
  }

  return {
    width: TABLE_MIN_WIDTH,
    height: TABLE_HEADER_HEIGHT + visibleColumns * COLUMN_ROW_HEIGHT + TABLE_PADDING,
  }
}

function autoLayoutERDiagram(
  nodes: Node[],
  edges: Edge[],
  options: ERLayoutOptions = {},
  showMode: ShowMode = 'ALL_FIELDS',
): Node[] {
  const { direction = 'TB', nodeSpacing = 60, rankSpacing = 100 } = options

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: rankSpacing,
    marginx: 40,
    marginy: 40,
  })

  for (const node of nodes) {
    const dims = getTableDimensions(node, showMode)
    g.setNode(node.id, { width: dims.width, height: dims.height })
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  Dagre.layout(g)

  const isHorizontal = direction === 'LR'
  const sourcePos = isHorizontal ? Position.Right : Position.Bottom
  const targetPos = isHorizontal ? Position.Left : Position.Top

  return nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node

    const dims = getTableDimensions(node, showMode)

    return {
      ...node,
      position: {
        x: pos.x - dims.width / 2,
        y: pos.y - dims.height / 2,
      },
      sourcePosition: sourcePos,
      targetPosition: targetPos,
    }
  })
}
```

### Using Measured Dimensions (More Accurate)

For the most accurate layout, run Dagre **after** React Flow has measured actual node dimensions:

```typescript
function autoLayoutERDiagramMeasured(
  nodes: Node[],
  edges: Edge[],
  options: ERLayoutOptions = {},
): Node[] {
  const { direction = 'TB', nodeSpacing = 60, rankSpacing = 100 } = options

  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: nodeSpacing, ranksep: rankSpacing, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? 220
    const height = node.measured?.height ?? node.height ?? 200
    g.setNode(node.id, { width, height })
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  Dagre.layout(g)

  const isHorizontal = direction === 'LR'

  return nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node

    const width = node.measured?.width ?? node.width ?? 220
    const height = node.measured?.height ?? node.height ?? 200

    return {
      ...node,
      position: { x: pos.x - width / 2, y: pos.y - height / 2 },
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
    }
  })
}
```

### Handling Non-Related Tables (Without ELK Grouping)

Since Dagre doesn't support parent-child grouping, position non-related tables manually:

```typescript
function separateNonRelatedTables(nodes: Node[], edges: Edge[]): Node[] {
  const connectedIds = new Set<string>()
  for (const edge of edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }

  const connected = nodes.filter((n) => connectedIds.has(n.id))
  const orphans = nodes.filter((n) => n.type === 'table' && !connectedIds.has(n.id))

  if (orphans.length === 0) return nodes

  let maxY = 0
  for (const node of connected) {
    const bottom = node.position.y + (node.measured?.height ?? 200)
    if (bottom > maxY) maxY = bottom
  }

  const GRID_COLS = 4
  const GAP_X = 240
  const GAP_Y = 220
  const START_Y = maxY + 80

  const repositioned = orphans.map((node, i) => ({
    ...node,
    position: {
      x: (i % GRID_COLS) * GAP_X,
      y: START_Y + Math.floor(i / GRID_COLS) * GAP_Y,
    },
  }))

  return [...connected, ...repositioned]
}
```

---

## Show Modes

Three display modes control how much detail each table node shows:

| Mode | Displays | Handles On |
|------|----------|------------|
| `TABLE_NAME` | Just the table name | Table header (left/right) |
| `KEY_ONLY` | Primary keys + foreign keys only | Individual columns |
| `ALL_FIELDS` | All columns with types | Individual columns |

```tsx
const ShowModeToggle: FC<{ value: ShowMode; onChange: (mode: ShowMode) => void }> = ({
  value, onChange,
}) => (
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
```

**Important:** When changing show modes, `sourceHandle`/`targetHandle` on edges must also change (null for TABLE_NAME, column IDs otherwise). Regenerate nodes/edges with `convertSchemaToNodes` when the mode changes.

---

## Highlighting & Interaction

When a user hovers or clicks a table, related tables and edges are visually highlighted.

```typescript
import type { Edge, Node } from '@xyflow/react'

type EdgeMap = Map<string, Set<string>>

function highlightNodesAndEdges(
  nodes: Node[],
  edges: Edge[],
  trigger: {
    activeTableName?: string
    hoverTableName?: string
  },
): { nodes: Node[]; edges: Edge[] } {
  const { activeTableName, hoverTableName } = trigger

  // Build adjacency map from edges
  const edgeMap: EdgeMap = new Map()
  for (const edge of edges) {
    if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, new Set())
    if (!edgeMap.has(edge.target)) edgeMap.set(edge.target, new Set())
    edgeMap.get(edge.source)!.add(edge.target)
    edgeMap.get(edge.target)!.add(edge.source)
  }

  const updatedNodes = nodes.map((node) => {
    if (node.type !== 'table') return node
    const tableName = (node.data as TableNodeData).table.name

    if (tableName === activeTableName) {
      return { ...node, data: { ...node.data, isActiveHighlighted: true, isHighlighted: false } }
    }

    const isRelated =
      (activeTableName && edgeMap.get(activeTableName)?.has(tableName)) ||
      tableName === hoverTableName ||
      (hoverTableName && edgeMap.get(hoverTableName)?.has(tableName))

    if (isRelated) {
      return { ...node, data: { ...node.data, isActiveHighlighted: false, isHighlighted: true } }
    }

    return { ...node, data: { ...node.data, isActiveHighlighted: false, isHighlighted: false } }
  })

  const updatedEdges = edges.map((edge) => {
    const isRelated =
      edge.source === activeTableName || edge.target === activeTableName ||
      edge.source === hoverTableName || edge.target === hoverTableName

    return {
      ...edge,
      zIndex: isRelated ? 1 : 0,
      data: { ...edge.data, isHighlighted: isRelated },
    }
  })

  return { nodes: updatedNodes, edges: updatedEdges }
}
```

---

## Constants

```typescript
const zIndex = {
  nodeDefault: 2,
  edgeHighlighted: 1,
  edgeDefault: 0,
}

const NON_RELATED_TABLE_GROUP_NODE_ID = 'non-related-table-group'

const columnHandleId = (tableName: string, columnName: string) =>
  `${tableName}-${columnName}`
```
