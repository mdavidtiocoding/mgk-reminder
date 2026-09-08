import type { UiTheme } from "@/lib/ui/theme"

/** Production UI — always Premium. */
export async function getUiTheme(): Promise<UiTheme> {
  return "premium"
}
