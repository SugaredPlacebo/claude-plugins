# ReactFlow in Next.js (App Router)

## Client Component Requirement

All files containing ReactFlow components must be Client Components:

```tsx
'use client';

import { ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

## Dynamic Import for Hydration Issues

If SSR causes hydration mismatches, use `next/dynamic` with `ssr: false`:

```tsx
// app/flow/page.tsx
import dynamic from 'next/dynamic';

const FlowCanvas = dynamic(() => import('@/components/flow/FlowCanvas'), {
  ssr: false,
  loading: () => <div>Loading flow...</div>,
});

export default function FlowPage() {
  return <FlowCanvas />;
}
```

## Page Layout Pattern

Ensure the flow container fills available space. Common pattern with App Router:

```tsx
// app/flow/layout.tsx
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      <header className="h-14 border-b flex items-center px-4">
        <h1>Flow Editor</h1>
      </header>
      <main className="flex-1 relative">
        {children}
      </main>
    </div>
  );
}
```

```tsx
// components/flow/FlowCanvas.tsx
'use client';

export default function FlowCanvas() {
  // ...state setup...
  return (
    // Use absolute positioning or explicit height
    <div className="absolute inset-0">
      <ReactFlow ...>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

## Tailwind CSS Integration

Style custom nodes with Tailwind classes. Remember `nodrag` and `nopan` for interactive elements:

```tsx
export function CustomNode({ data, selected }: NodeProps<CustomNodeType>) {
  return (
    <div className={cn(
      'rounded-lg border-2 bg-card p-3 shadow-sm min-w-[150px]',
      selected ? 'border-primary' : 'border-border'
    )}>
      <Handle type="target" position={Position.Top} />
      <p className="text-sm font-medium">{data.label}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```
