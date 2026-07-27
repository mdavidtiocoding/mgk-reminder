import type { FlowConfigRow } from "@/components/settings/flow-config-table"
import { getStep } from "@/lib/steps"

export type FlowValidationIssue = {
  severity: "error" | "warning"
  stepCode?: string
  message: string
}

function wouldCreateCycle(
  stepCode: string,
  prerequisites: string[],
  prereqMap: Map<string, string[]>
): boolean {
  if (prerequisites.includes(stepCode)) return true
  const tempMap = new Map(prereqMap)
  tempMap.set(stepCode, prerequisites)

  function canReach(from: string, target: string, visited: Set<string>): boolean {
    if (from === target) return true
    if (visited.has(from)) return false
    visited.add(from)
    return (tempMap.get(from) ?? []).some((code) => canReach(code, target, visited))
  }

  return prerequisites.some((code) => canReach(code, stepCode, new Set()))
}

export function validateFlowConfig(rows: FlowConfigRow[]): FlowValidationIssue[] {
  const issues: FlowValidationIssue[] = []
  const codes = new Set(rows.map((r) => r.code))
  const prereqMap = new Map(rows.map((r) => [r.code, r.prerequisites]))
  const referencedAsPrereq = new Set<string>()

  for (const row of rows) {
    for (const prereq of row.prerequisites) {
      referencedAsPrereq.add(prereq)
      if (!codes.has(prereq)) {
        issues.push({
          severity: "error",
          stepCode: row.code,
          message: `${row.code}: prasyarat "${prereq}" tidak ditemukan.`,
        })
      }
    }

    if (wouldCreateCycle(row.code, row.prerequisites, prereqMap)) {
      issues.push({
        severity: "error",
        stepCode: row.code,
        message: `${row.code}: circular dependency pada prasyarat.`,
      })
    }

    for (const unlock of row.unlocksSteps) {
      if (!codes.has(unlock)) {
        issues.push({
          severity: "error",
          stepCode: row.code,
          message: `${row.code}: memicu step "${unlock}" tidak ditemukan.`,
        })
      }
    }

    const stepDef = getStep(row.code)
    if (!stepDef) {
      issues.push({
        severity: "warning",
        stepCode: row.code,
        message: `${row.code}: tidak ada di definisi workflow bawaan.`,
      })
    } else if (stepDef.trigger.type === "after_step") {
      const ref = stepDef.trigger.stepCode
      if (!codes.has(ref)) {
        issues.push({
          severity: "warning",
          stepCode: row.code,
          message: `${row.code}: trigger merujuk step "${ref}" yang tidak ada.`,
        })
      }
    }

    if (
      (row.completionMode === "checklist" ||
        row.completionMode === "checklist_keterangan") &&
      row.checklistItems.length === 0 &&
      row.substeps.length === 0
    ) {
      issues.push({
        severity: "warning",
        stepCode: row.code,
        message: `${row.code}: mode checklist tanpa item checklist.`,
      })
    }
  }

  const roots = rows.filter((r) => r.prerequisites.length === 0)
  if (roots.length === 0 && rows.length > 0) {
    issues.push({
      severity: "warning",
      message: "Tidak ada step awal (tanpa prasyarat).",
    })
  }

  for (const row of rows) {
    if (row.code === "M1") continue
    if (
      row.prerequisites.length === 0 &&
      row.code !== roots[0]?.code &&
      roots.length > 1
    ) {
      issues.push({
        severity: "warning",
        stepCode: row.code,
        message: `${row.code}: step tanpa prasyarat (mungkin orphan / entry point ganda).`,
      })
    }
    if (
      row.prerequisites.length > 0 &&
      !referencedAsPrereq.has(row.code) &&
      row.code !== "M1" &&
      !rows.some((other) => other.unlocksSteps.includes(row.code))
    ) {
      const hasDownstream = rows.some((other) =>
        other.prerequisites.includes(row.code)
      )
      if (!hasDownstream && row.unlocksSteps.length === 0) {
        issues.push({
          severity: "warning",
          stepCode: row.code,
          message: `${row.code}: tidak memicu step lain (dead-end workflow).`,
        })
      }
    }
  }

  return issues
}
