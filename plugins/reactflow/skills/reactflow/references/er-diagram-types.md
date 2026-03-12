# ER Diagram Data Model & Schema-to-Node Conversion

Reference for building ER diagrams with React Flow. Covers the typed schema model, relationship derivation from foreign keys, and conversion to React Flow nodes/edges.

---

## Architecture Overview

```
Schema (tables, columns, constraints)
  │
  ▼
convertSchemaToNodes()  ──→  Node[] + Edge[]
  │
  ▼
computeAutoLayout()     ──→  Positioned Node[]  (via ELK or Dagre)
  │
  ▼
ReactFlow canvas        ──→  TableNode + RelationshipEdge
  │
  ▼
highlightNodesAndEdges()──→  Interactive hover/select highlighting
```

**Key dependencies:**
- `@xyflow/react` ^12.8.6 — React Flow core
- `elkjs` ^0.10.0 — Eclipse Layout Kernel for auto-layout (Option A)
- `@dagrejs/dagre` — Dagre hierarchical layout (Option B, simpler)

**Custom React Flow types registered:**
```typescript
const nodeTypes = {
  table: TableNode,
  nonRelatedTableGroup: NonRelatedTableGroupNode,
}

const edgeTypes = {
  relationship: RelationshipEdge,
}
```

---

## Core Schema Types

```typescript
type Column = {
  name: string
  type: string                  // e.g. "varchar", "integer", "uuid"
  default: string | number | boolean | null
  notNull: boolean
  check: string | null
  comment: string | null
}

type Index = {
  name: string
  unique: boolean
  columns: string[]
  type: string                  // e.g. "btree"
}

type PrimaryKeyConstraint = {
  type: 'PRIMARY KEY'
  name: string
  columnNames: string[]
}

type ForeignKeyConstraint = {
  type: 'FOREIGN KEY'
  name: string
  columnNames: string[]         // columns in THIS table
  targetTableName: string       // referenced table
  targetColumnNames: string[]   // referenced columns
  updateConstraint: 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'SET_DEFAULT' | 'NO_ACTION'
  deleteConstraint: 'CASCADE' | 'RESTRICT' | 'SET_NULL' | 'SET_DEFAULT' | 'NO_ACTION'
}

type UniqueConstraint = {
  type: 'UNIQUE'
  name: string
  columnNames: string[]
}

type CheckConstraint = {
  type: 'CHECK'
  name: string
  detail: string
}

type Constraint = PrimaryKeyConstraint | ForeignKeyConstraint | UniqueConstraint | CheckConstraint

type Table = {
  name: string
  columns: Record<string, Column>
  comment: string | null
  indexes: Record<string, Index>
  constraints: Record<string, Constraint>
}

type Schema = {
  tables: Record<string, Table>
  enums: Record<string, { name: string; values: string[]; comment: string | null }>
  extensions: Record<string, { name: string }>
}
```

---

## Relationship Derivation from Foreign Keys

Relationships are **not stored directly** — derive them from `FOREIGN KEY` constraints at runtime:

```typescript
type Cardinality = 'ONE_TO_ONE' | 'ONE_TO_MANY'

type Relationship = {
  name: string
  primaryTableName: string      // the referenced table (target of FK)
  primaryColumnName: string     // the referenced column
  foreignTableName: string      // the table that HAS the FK
  foreignColumnName: string     // the FK column
  cardinality: Cardinality
  updateConstraint?: string
  deleteConstraint?: string
}

function constraintsToRelationships(tables: Record<string, Table>): Record<string, Relationship> {
  const relationships: Record<string, Relationship> = {}

  for (const table of Object.values(tables)) {
    for (const constraint of Object.values(table.constraints)) {
      if (constraint.type !== 'FOREIGN KEY') continue

      const fk = constraint as ForeignKeyConstraint
      const cardinality = determineCardinality(tables, table.name, fk.columnNames)

      const columnCount = Math.min(fk.columnNames.length, fk.targetColumnNames.length)

      for (let i = 0; i < columnCount; i++) {
        const columnName = fk.columnNames[i]
        const targetColumnName = fk.targetColumnNames[i]
        if (!columnName || !targetColumnName) continue

        const key = `${table.name}_${constraint.name}_${i}`

        relationships[key] = {
          name: key,
          primaryTableName: fk.targetTableName,
          primaryColumnName: targetColumnName,
          foreignTableName: table.name,
          foreignColumnName: columnName,
          cardinality,
          updateConstraint: fk.updateConstraint,
          deleteConstraint: fk.deleteConstraint,
        }
      }
    }
  }

  return relationships
}

/**
 * If FK columns are also covered by a UNIQUE constraint → ONE_TO_ONE.
 * Otherwise → ONE_TO_MANY (the default).
 */
function determineCardinality(
  tables: Record<string, Table>,
  tableName: string,
  foreignKeyColumns: string[],
): Cardinality {
  const table = tables[tableName]
  if (!table) return 'ONE_TO_MANY'

  for (const constraint of Object.values(table.constraints)) {
    if (constraint.type === 'UNIQUE') {
      const uniqueSet = new Set(constraint.columnNames)
      if (foreignKeyColumns.every((col) => uniqueSet.has(col))) {
        return 'ONE_TO_ONE'
      }
    }
  }

  return 'ONE_TO_MANY'
}
```

### Utility: isPrimaryKey

```typescript
function isPrimaryKey(columnName: string, constraints: Record<string, Constraint>): boolean {
  return Object.values(constraints).some(
    (c) => c.type === 'PRIMARY KEY' && c.columnNames.includes(columnName),
  )
}
```

---

## React Flow Type Definitions

```typescript
import type { Node } from '@xyflow/react'

type ShowMode = 'ALL_FIELDS' | 'TABLE_NAME' | 'KEY_ONLY'

type TableNodeData = {
  table: Table
  isActiveHighlighted: boolean
  isHighlighted: boolean
  isTooltipVisible: boolean
  sourceColumnName: string | undefined
  targetColumnCardinalities?: Record<string, Cardinality | undefined>
  showMode?: ShowMode
}

type TableNodeType = Node<TableNodeData, 'table'>
```

---

## Converting Schema to React Flow Nodes & Edges

```typescript
import type { Edge, Node } from '@xyflow/react'

const NON_RELATED_TABLE_GROUP_NODE_ID = 'non-related-table-group'

const zIndex = {
  nodeDefault: 2,
  edgeHighlighted: 1,
  edgeDefault: 0,
}

const columnHandleId = (tableName: string, columnName: string) =>
  `${tableName}-${columnName}`

function convertSchemaToNodes({
  schema,
  showMode,
}: {
  schema: Schema
  showMode: ShowMode
}): { nodes: Node[]; edges: Edge[] } {
  const tables = Object.values(schema.tables)
  const relationships = Object.values(constraintsToRelationships(schema.tables))

  // Build lookup maps
  const tablesWithRelationships = new Set<string>()
  const sourceColumns = new Map<string, string>()
  const tableColumnCardinalities = new Map<string, Record<string, Cardinality>>()

  for (const rel of relationships) {
    tablesWithRelationships.add(rel.primaryTableName)
    tablesWithRelationships.add(rel.foreignTableName)
    sourceColumns.set(rel.primaryTableName, rel.primaryColumnName)
    tableColumnCardinalities.set(rel.foreignTableName, {
      ...tableColumnCardinalities.get(rel.foreignTableName),
      [rel.foreignColumnName]: rel.cardinality,
    })
  }

  // Create nodes
  let hasNonRelatedTables = false
  const tableNodes = tables.map((table) => {
    const isNonRelated = !tablesWithRelationships.has(table.name)
    if (isNonRelated) hasNonRelatedTables = true

    return {
      id: table.name,
      type: 'table' as const,
      data: {
        table,
        isActiveHighlighted: false,
        isHighlighted: false,
        isTooltipVisible: false,
        sourceColumnName: sourceColumns.get(table.name),
        targetColumnCardinalities: tableColumnCardinalities.get(table.name),
      },
      position: { x: 0, y: 0 },
      zIndex: zIndex.nodeDefault,
      ...(isNonRelated ? { parentId: NON_RELATED_TABLE_GROUP_NODE_ID } : {}),
    }
  })

  // Group node for non-related tables (optional, for ELK)
  const nodes: Node[] = [
    ...(hasNonRelatedTables
      ? [{
          id: NON_RELATED_TABLE_GROUP_NODE_ID,
          type: 'nonRelatedTableGroup' as const,
          data: {},
          position: { x: 0, y: 0 },
        }]
      : []),
    ...tableNodes,
  ]

  // Create edges from relationships
  const edges: Edge[] = relationships.map((rel) => ({
    id: rel.name,
    type: 'relationship' as const,
    source: rel.primaryTableName,
    target: rel.foreignTableName,
    sourceHandle:
      showMode === 'TABLE_NAME'
        ? null
        : columnHandleId(rel.primaryTableName, rel.primaryColumnName),
    targetHandle:
      showMode === 'TABLE_NAME'
        ? null
        : columnHandleId(rel.foreignTableName, rel.foreignColumnName),
    data: {
      cardinality: rel.cardinality,
      isHighlighted: false,
    },
  }))

  return { nodes, edges }
}
```

**Key design decisions:**
- Tables without relationships are grouped under a `nonRelatedTableGroup` parent node for ELK layout.
- Handle IDs use `tableName-columnName` format for column-level edge connections.
- In `TABLE_NAME` mode, handles attach to the table header (`sourceHandle`/`targetHandle` = null).
