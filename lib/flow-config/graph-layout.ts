import type { Edge, Node } from "@xyflow/react"
import { MarkerType } from "@xyflow/react"
import dagre from "@dagrejs/dagre"

import type { FlowConfigRow } from "@/components/settings/flow-config-table"

/** Fixed node dimensions used by Dagre layout and custom nodes. */
export const FLOW_NODE_WIDTH = 248
export const FLOW_NODE_HEIGHT = 152

export type FlowStepNodeData = {
  row: FlowConfigRow
  displayName: string
  selected: boolean
  highlighted: boolean
  hasChildren: boolean
  isCollapsed: boolean
  /** Precomputed for tooltips — keeps node component presentational. */
  triggerSummary: string
  /** Extensible metadata for future features (critical path, validation, etc.) */
  meta?: Record<string, unknown>
}

export type FlowGraphLayoutOptions = {
  collapsedNodes: Set<string>
  searchQuery: string
  selectedCode: string | null
}

export function buildUnlockAdjacency(rows: FlowConfigRow[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const row of rows) {
    if (row.unlocksSteps.length > 0) {
      map.set(row.code, [...row.unlocksSteps])
    }
  }
  return map
}

function collectDescendants(
  code: string,
  adjacency: Map<string, string[]>,
  acc: Set<string>
) {
  for (const child of adjacency.get(code) ?? []) {
    if (acc.has(child)) continue
    acc.add(child)
    collectDescendants(child, adjacency, acc)
  }
}

export function getVisibleStepCodes(
  rows: FlowConfigRow[],
  collapsedNodes: Set<string>
): Set<string> {
  const all = new Set(rows.map((r) => r.code))
  const adjacency = buildUnlockAdjacency(rows)
  const hidden = new Set<string>()

  for (const collapsed of collapsedNodes) {
    collectDescendants(collapsed, adjacency, hidden)
  }

  const visible = new Set<string>()
  for (const code of all) {
    if (!hidden.has(code)) visible.add(code)
  }
  return visible
}

export function buildFlowGraphElements(
  rows: FlowConfigRow[],
  nameByCode: Map<string, string>,
  triggerSummaryByCode: Map<string, string>,
  options: FlowGraphLayoutOptions
): { nodes: Node<FlowStepNodeData>[]; edges: Edge[] } {
  const visible = getVisibleStepCodes(rows, options.collapsedNodes)
  const adjacency = buildUnlockAdjacency(rows)
  const q = options.searchQuery.trim().toLowerCase()

  const nodes: Node<FlowStepNodeData>[] = rows
    .filter((row) => visible.has(row.code))
    .map((row) => {
      const displayName = nameByCode.get(row.code) ?? row.name
      const highlighted =
        q.length > 0 &&
        (row.code.toLowerCase().includes(q) ||
          displayName.toLowerCase().includes(q) ||
          row.division.toLowerCase().includes(q))

      return {
        id: row.code,
        type: "flowStep",
        position: { x: 0, y: 0 },
        data: {
          row,
          displayName,
          selected: options.selectedCode === row.code,
          highlighted,
          hasChildren: (adjacency.get(row.code)?.length ?? 0) > 0,
          isCollapsed: options.collapsedNodes.has(row.code),
          triggerSummary: triggerSummaryByCode.get(row.code) ?? "",
        },
      }
    })

  const edges: Edge[] = []
  for (const row of rows) {
    if (!visible.has(row.code)) continue
    for (const target of row.unlocksSteps) {
      if (!visible.has(target)) continue
      edges.push({
        id: `${row.code}→${target}`,
        source: row.code,
        target,
        type: "default",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 18,
          height: 18,
          color: "var(--muted-foreground)",
        },
        style: { stroke: "var(--muted-foreground)", strokeWidth: 1.5 },
      })
    }
  }

  const { nodes: laidOutNodes, edges: laidOutEdges } = applyDagreLayout(nodes, edges)
  return { nodes: laidOutNodes, edges: laidOutEdges }
}

function applyDagreLayout(
  nodes: Node<FlowStepNodeData>[],
  edges: Edge[]
): { nodes: Node<FlowStepNodeData>[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges }

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: "LR",
    nodesep: 48,
    ranksep: 88,
    marginx: 24,
    marginy: 24,
  })

  for (const node of nodes) {
    graph.setNode(node.id, { width: FLOW_NODE_WIDTH, height: FLOW_NODE_HEIGHT })
  }
  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  const laidOutNodes = nodes.map((node) => {
    const pos = graph.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - FLOW_NODE_WIDTH / 2,
        y: pos.y - FLOW_NODE_HEIGHT / 2,
      },
    }
  })

  return { nodes: laidOutNodes, edges }
}

export function getAllCollapsibleCodes(rows: FlowConfigRow[]): string[] {
  return rows.filter((r) => r.unlocksSteps.length > 0).map((r) => r.code)
}
