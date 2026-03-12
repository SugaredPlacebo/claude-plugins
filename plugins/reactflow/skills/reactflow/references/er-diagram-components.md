# ER Diagram Components

Reference for TableNode, column rendering with handles, RelationshipEdge, and SVG cardinality markers (crow's foot notation).

---

## TableNode (Outer Wrapper)

Three-layer component: outer wrapper → header → column list.

```tsx
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { FC } from 'react'

type Props = NodeProps<Node<TableNodeData, 'table'>>

const TableNode: FC<Props> = ({ data }) => {
  const showMode = data.showMode ?? 'ALL_FIELDS'
  const name = data.table.name

  return (
    <div
      className={`
        min-w-[172px] rounded-lg border shadow-lg
        bg-[var(--node-background,#1a1a2e)]
        ${data.isActiveHighlighted
          ? 'border-2 border-emerald-400 shadow-emerald-400/40'
          : data.isHighlighted
            ? 'border border-emerald-400 shadow-emerald-400/40'
            : 'border border-white/20'
        }
      `}
    >
      <TableHeader data={data} showMode={showMode} />
      {showMode === 'ALL_FIELDS' && <TableColumnList data={data} />}
      {showMode === 'KEY_ONLY' && <TableColumnList data={data} filter="KEY_ONLY" />}
    </div>
  )
}
```

---

## TableHeader

Shows the table name, icon, and — in `TABLE_NAME` mode — the React Flow handles.

```tsx
import { Handle, Position } from '@xyflow/react'
import { Table2 } from 'lucide-react'
import type { FC } from 'react'

type Props = {
  data: TableNodeData
  showMode: ShowMode
}

const TableHeader: FC<Props> = ({ data, showMode }) => {
  const name = data.table.name
  const isTarget = data.targetColumnCardinalities !== undefined
  const isSource = data.sourceColumnName !== undefined

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2
        ${showMode === 'TABLE_NAME' ? 'relative' : 'border-b border-white/10'}
      `}
    >
      <Table2 className="w-4 h-4 text-emerald-400 shrink-0" />
      <span className="text-sm font-medium text-white truncate">{name}</span>

      {/* In TABLE_NAME mode, handles attach to the header */}
      {showMode === 'TABLE_NAME' && (
        <>
          {isTarget && (
            <Handle
              id={name}
              type="target"
              position={Position.Left}
              className="!w-2 !h-2 !bg-emerald-400 !border-none"
            />
          )}
          {isSource && (
            <Handle
              id={name}
              type="source"
              position={Position.Right}
              className="!w-2 !h-2 !bg-emerald-400 !border-none"
            />
          )}
        </>
      )}
    </div>
  )
}
```

---

## TableColumnList

```tsx
import type { FC } from 'react'

type Props = {
  data: TableNodeData
  filter?: 'KEY_ONLY'
}

const TableColumnList: FC<Props> = ({ data, filter }) => {
  const columns = Object.values(data.table.columns)

  return (
    <ul className="py-1">
      {columns.map((column) => {
        if (filter === 'KEY_ONLY') {
          const isPK = isPrimaryKey(column.name, data.table.constraints)
          const isFK = data.targetColumnCardinalities?.[column.name] !== undefined
          if (!isPK && !isFK) return null
        }

        const handleId = columnHandleId(data.table.name, column.name)
        const isSource = data.sourceColumnName === column.name
        const targetCardinality = data.targetColumnCardinalities?.[column.name]

        return (
          <TableColumn
            key={column.name}
            table={data.table}
            column={column}
            handleId={handleId}
            isSource={isSource}
            targetCardinality={targetCardinality}
            isHighlightedTable={data.isHighlighted || data.isActiveHighlighted}
          />
        )
      })}
    </ul>
  )
}
```

---

## TableColumn (Individual Row)

Each column gets its own row with an icon indicating its role and — if it participates in a relationship — its own React Flow `Handle`.

```tsx
import { Handle, Position } from '@xyflow/react'
import { KeyRound, Link, Diamond } from 'lucide-react'
import type { FC } from 'react'

/**
 * Column icon logic:
 * - Primary Key → Key icon (amber)
 * - Foreign Key (source or target) → Link icon (blue)
 * - NOT NULL → Filled diamond (gray)
 * - Nullable → Empty diamond (gray)
 */
const ColumnIcon: FC<{ table: Table; column: Column; isSource: boolean; targetCardinality?: Cardinality }> = ({
  table, column, isSource, targetCardinality,
}) => {
  if (isPrimaryKey(column.name, table.constraints)) {
    return <KeyRound className="w-4 h-4 text-amber-400" aria-label="Primary Key" />
  }
  if (isSource || targetCardinality) {
    return <Link className="w-4 h-4 text-blue-400" aria-label="Foreign Key" />
  }
  if (column.notNull) {
    return <Diamond className="w-4 h-4 text-gray-400 fill-gray-400" aria-label="Not Null" />
  }
  return <Diamond className="w-4 h-4 text-gray-500" aria-label="Nullable" />
}

type Props = {
  table: Table
  column: Column
  handleId: string
  isSource: boolean
  targetCardinality?: Cardinality
  isHighlightedTable?: boolean
}

const TableColumn: FC<Props> = ({
  table, column, handleId, isSource, targetCardinality, isHighlightedTable,
}) => {
  const shouldHighlight = isHighlightedTable && (isSource || !!targetCardinality)

  return (
    <li
      className={`
        relative flex items-center gap-2 px-3 py-1
        ${shouldHighlight ? 'bg-emerald-400/10' : ''}
      `}
    >
      <ColumnIcon
        table={table}
        column={column}
        isSource={isSource}
        targetCardinality={targetCardinality}
      />

      <span className="flex-1 flex items-center justify-between gap-2 min-w-0">
        <span className="text-xs text-white truncate">{column.name}</span>
        <span className="text-xs text-gray-400 shrink-0">{column.type}</span>
      </span>

      {/* Source handle (right side) — this column references another table */}
      {isSource && (
        <Handle
          id={handleId}
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !bg-blue-400 !border-none"
        />
      )}

      {/* Target handle (left side) — another table references this column */}
      {targetCardinality && (
        <Handle
          id={handleId}
          type="target"
          position={Position.Left}
          className="!w-2 !h-2 !bg-blue-400 !border-none"
        />
      )}
    </li>
  )
}
```

**Handle placement recap:**
- **Source handles** (right side): on the column that is referenced by another table's FK
- **Target handles** (left side): on the FK column itself
- Handle IDs: `${tableName}-${columnName}` — must match `convertSchemaToNodes` `sourceHandle`/`targetHandle`

---

## RelationshipEdge with Cardinality Markers

Uses Bezier paths and references SVG markers defined separately.

```tsx
import { BaseEdge, type EdgeProps, getBezierPath } from '@xyflow/react'
import type { FC } from 'react'

type RelationshipEdgeData = {
  isHighlighted: boolean
  cardinality: Cardinality
}

type RelationshipEdgeType = Edge<RelationshipEdgeData, 'relationship'>

const PARTICLE_COUNT = 6
const ANIMATE_DURATION = 6

const RelationshipEdge: FC<EdgeProps<RelationshipEdgeType>> = ({
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  id, data,
}) => {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const markerStart = data?.isHighlighted
    ? 'url(#zeroOrOneRightHighlight)'
    : 'url(#zeroOrOneRight)'

  const markerEnd = data?.cardinality === 'ONE_TO_ONE'
    ? (data?.isHighlighted ? 'url(#zeroOrOneLeftHighlight)' : 'url(#zeroOrOneLeft)')
    : (data?.isHighlighted ? 'url(#zeroOrManyLeftHighlight)' : 'url(#zeroOrManyLeft)')

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={markerStart}
        markerEnd={markerEnd}
        style={{
          stroke: data?.isHighlighted ? 'var(--color-emerald-400)' : 'var(--color-gray-500)',
          strokeWidth: 1,
          transition: 'stroke 0.3s ease',
        }}
      />

      {/* Animated particles when highlighted */}
      {data?.isHighlighted &&
        [...Array(PARTICLE_COUNT)].map((_, i) => (
          <ellipse key={`particle-${i}`} rx="5" ry="1.2" fill="url(#particleGradient)">
            <animateMotion
              begin={`${-i * (ANIMATE_DURATION / PARTICLE_COUNT)}s`}
              dur={`${ANIMATE_DURATION}s`}
              repeatCount="indefinite"
              rotate="auto"
              path={edgePath}
              calcMode="spline"
              keySplines="0.42, 0, 0.58, 1.0"
            />
          </ellipse>
        ))}
    </>
  )
}
```

**Marker selection logic:**

| Side | Cardinality | Marker |
|------|-------------|--------|
| Source (start) | Always | `zeroOrOneRight` (○─│) — "this row" |
| Target (end) | ONE_TO_ONE | `zeroOrOneLeft` (│─○) |
| Target (end) | ONE_TO_MANY | `zeroOrManyLeft` (│─<○) — crow's foot |

---

## SVG Cardinality Markers (Crow's Foot Notation)

Render once at the top of the page (outside ReactFlow) and reference by ID in edge `markerStart`/`markerEnd`.

### CardinalityZeroOrOneLeftMarker (│─○)

```tsx
// Rendered at the TARGET end for ONE_TO_ONE relationships
const CardinalityZeroOrOneLeftMarker: FC<{ id: string; color: string; isHighlighted?: boolean }> = ({
  id, color, isHighlighted,
}) => (
  <svg width="0" height="0">
    <defs>
      <marker
        id={id}
        viewBox="0 -10 23.5 30"
        markerWidth="23.5"
        markerHeight="30"
        refX="1.5"
        refY="8"
        orient="auto"
        color={color}
      >
        {/* Circle (zero-or-one indicator) */}
        <path
          d="M6.665 12.66C9.241 12.66 11.33 10.57 11.33 7.995C11.33 5.419 9.241 3.33 6.665 3.33
             C4.089 3.33 2 5.419 2 7.995C2 10.57 4.089 12.66 6.665 12.66Z"
          fill="transparent"
        />
        <path
          fillRule="evenodd" clipRule="evenodd"
          d="M6.665 3.83C4.365 3.83 2.5 5.695 2.5 7.995C2.5 10.295 4.365 12.16 6.665 12.16
             C8.965 12.16 10.83 10.295 10.83 7.995C10.83 5.695 8.965 3.83 6.665 3.83Z
             M1.5 7.995C1.5 5.143 3.812 2.83 6.665 2.83C9.518 2.83 11.83 5.143 11.83 7.995
             C11.83 10.848 9.518 13.16 6.665 13.16C3.812 13.16 1.5 10.848 1.5 7.995Z"
          fill="currentColor"
        />
        {/* Vertical line (one indicator) */}
        <path
          fillRule="evenodd" clipRule="evenodd"
          d="M16 2.83C16.276 2.83 16.5 3.054 16.5 3.33V12.663C16.5 12.94 16.276 13.163 16 13.163
             C15.724 13.163 15.5 12.94 15.5 12.663V3.33C15.5 3.054 15.724 2.83 16 2.83Z"
          fill="currentColor"
        />
        {/* Horizontal connector line */}
        <path d="M23.5 7.5H11V8.5H23.5V7.5Z" fill="currentColor" />
        {isHighlighted && (
          <text x="6" y="-8" textAnchor="middle" fontSize="8" fill="currentColor">1</text>
        )}
      </marker>
    </defs>
  </svg>
)
```

### CardinalityZeroOrOneRightMarker (○─│)

```tsx
// Rendered at the SOURCE end (always used — "one row from this table")
const CardinalityZeroOrOneRightMarker: FC<{ id: string; color: string; isHighlighted?: boolean }> = ({
  id, color, isHighlighted,
}) => (
  <svg width="0" height="0">
    <defs>
      <marker
        id={id}
        viewBox="0 -10 23 30"
        markerWidth="23"
        markerHeight="30"
        refX="19.3"
        refY="8"
        orient="auto"
        color={color}
      >
        <path
          d="M15.835 12.66C18.411 12.66 20.5 10.57 20.5 7.995C20.5 5.419 18.411 3.33 15.835 3.33
             C13.259 3.33 11.17 5.419 11.17 7.995C11.17 10.57 13.259 12.66 15.835 12.66Z"
          fill="transparent"
        />
        <path
          fillRule="evenodd" clipRule="evenodd"
          d="M15.835 3.83C13.535 3.83 11.67 5.695 11.67 7.995C11.67 10.295 13.535 12.16 15.835 12.16
             C18.135 12.16 20 10.295 20 7.995C20 5.695 18.135 3.83 15.835 3.83Z
             M10.67 7.995C10.67 5.143 12.982 2.83 15.835 2.83C18.688 2.83 21 5.143 21 7.995
             C21 10.848 18.688 13.16 15.835 13.16C12.982 13.16 10.67 10.848 10.67 7.995Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd" clipRule="evenodd"
          d="M6.5 2.83C6.776 2.83 7 3.054 7 3.33V12.663C7 12.94 6.776 13.163 6.5 13.163
             C6.224 13.163 6 12.94 6 12.663V3.33C6 3.054 6.224 2.83 6.5 2.83Z"
          fill="currentColor"
        />
        <path d="M11 7.7H0.5V8.7H11V7.7Z" fill="currentColor" />
        {isHighlighted && (
          <text x="15.5" y="-8" textAnchor="middle" fontSize="8" fill="currentColor">1</text>
        )}
      </marker>
    </defs>
  </svg>
)
```

### CardinalityZeroOrManyLeftMarker (│─<○) — Crow's Foot

```tsx
// Rendered at the TARGET end for ONE_TO_MANY relationships
const CardinalityZeroOrManyLeftMarker: FC<{ id: string; color: string; isHighlighted?: boolean }> = ({
  id, color, isHighlighted,
}) => (
  <svg width="0" height="0">
    <defs>
      <marker
        id={id}
        viewBox="0 -10 23.5 30"
        markerWidth="23.5"
        markerHeight="30"
        refX="1.5"
        refY="8"
        orient="auto"
        color={color}
      >
        {/* Crow's foot (three lines radiating from a point) */}
        <path
          fillRule="evenodd" clipRule="evenodd"
          d="M23.238 1.94C23.481 1.808 23.571 1.505 23.44 1.262C23.308 1.019 23.005 0.929 22.762 1.06
             L10.762 7.56C10.606 7.645 10.507 7.805 10.5 7.982C10.494 8.159 10.582 8.326 10.731 8.421
             L10.753 8.436L10.819 8.478C10.877 8.515 10.963 8.569 11.073 8.638
             C11.293 8.777 11.612 8.977 12.008 9.222C12.8 9.711 13.902 10.379 15.138 11.097
             C17.6 12.526 20.635 14.172 22.829 14.97C23.089 15.064 23.376 14.93 23.47 14.671
             C23.564 14.412 23.43 14.125 23.171 14.03
             C21.07 13.266 18.104 11.662 15.64 10.232C14.519 9.581 13.51 8.971 12.744 8.5
             H23.333C23.61 8.5 23.833 8.276 23.833 8C23.833 7.724 23.61 7.5 23.333 7.5
             H12.973L23.238 1.94Z"
          fill="currentColor"
        />
        {/* Circle */}
        <path
          d="M6.665 13.16C9.241 13.16 11.33 11.07 11.33 8.495C11.33 5.919 9.241 3.83 6.665 3.83
             C4.089 3.83 2 5.919 2 8.495C2 11.07 4.089 13.16 6.665 13.16Z"
          fill="transparent"
        />
        <path
          fillRule="evenodd" clipRule="evenodd"
          d="M6.665 4.33C4.365 4.33 2.5 6.195 2.5 8.495C2.5 10.795 4.365 12.66 6.665 12.66
             C8.965 12.66 10.83 10.795 10.83 8.495C10.83 6.195 8.965 4.33 6.665 4.33Z
             M1.5 8.495C1.5 5.642 3.812 3.33 6.665 3.33C9.518 3.33 11.83 5.642 11.83 8.495
             C11.83 11.348 9.518 13.66 6.665 13.66C3.812 13.66 1.5 11.348 1.5 8.495Z"
          fill="currentColor"
        />
        {isHighlighted && (
          <text x="6" y="-9" textAnchor="middle" fontSize="9" fill="currentColor">n</text>
        )}
      </marker>
    </defs>
  </svg>
)
```

### Rendering All Markers

Place this component at the top level of the app (outside `<ReactFlow>`):

```tsx
const CardinalityMarkers: FC = () => (
  <div style={{ position: 'absolute', top: 0, left: 0 }}>
    {/* Normal state markers */}
    <CardinalityZeroOrOneLeftMarker  id="zeroOrOneLeft"  color="var(--color-gray-500)" />
    <CardinalityZeroOrOneRightMarker id="zeroOrOneRight" color="var(--color-gray-500)" />
    <CardinalityZeroOrManyLeftMarker id="zeroOrManyLeft"  color="var(--color-gray-500)" />

    {/* Highlighted state markers */}
    <CardinalityZeroOrOneLeftMarker  id="zeroOrOneLeftHighlight"  color="var(--color-emerald-400)" isHighlighted />
    <CardinalityZeroOrOneRightMarker id="zeroOrOneRightHighlight" color="var(--color-emerald-400)" isHighlighted />
    <CardinalityZeroOrManyLeftMarker id="zeroOrManyLeftHighlight"  color="var(--color-emerald-400)" isHighlighted />
  </div>
)
```

### Animated Edge Particle Gradient

```tsx
const RelationshipEdgeParticleMarker: FC = () => (
  <svg width="0" height="0" style={{ position: 'absolute', top: 0, left: 0, overflow: 'hidden', opacity: 0 }}>
    <defs>
      <radialGradient id="particleGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
        <stop offset="0%" stopColor="var(--color-emerald-400)" stopOpacity="1" />
        <stop offset="100%" stopColor="var(--color-emerald-400)" stopOpacity="0.4" />
      </radialGradient>
    </defs>
  </svg>
)
```

---

## NonRelatedTableGroupNode

A minimal container for tables that have no relationships (used with ELK layout):

```tsx
const NonRelatedTableGroupNode: FC = () => (
  <div style={{ width: '100%', height: '100%' }} />
)
```
