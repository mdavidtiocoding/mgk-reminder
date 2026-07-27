/**
 * Flow graph module — extensible architecture for workflow visualization.
 *
 * Future hooks (not implemented yet):
 * - Drag & drop repositioning → enable nodesDraggable + persist positions
 * - Inline editing → double-click handlers in flow-graph-canvas
 * - Context menu → onNodeContextMenu on ReactFlow
 * - Colored edges → edge.data.criticalPath in buildFlowGraphElements
 * - Validation overlay → FlowStepNodeData.meta.validationIssue
 */

export { FlowGraphView } from "@/components/settings/flow-config/flow-graph-view"
export type { FlowStepNodeData } from "@/lib/flow-config/graph-layout"
