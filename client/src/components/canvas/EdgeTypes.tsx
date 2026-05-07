import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow'

export const StackEdge = memo(
  ({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) => {
    const [edgePath] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: 12,
    })

    return (
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#c0392b',
          strokeWidth: 1.5,
          strokeDasharray: '5 4',
          opacity: 0.6,
        }}
        markerEnd="url(#stack-arrow)"
      />
    )
  }
)

StackEdge.displayName = 'StackEdge'

// inject arrow marker once into SVG defs
export function StackArrowDef() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker id="stack-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill="#c0392b" opacity="0.7" />
        </marker>
      </defs>
    </svg>
  )
}
