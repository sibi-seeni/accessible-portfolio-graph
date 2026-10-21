export type ToolName =
  | "inspect"
  | "paths"
  | "shock"
  | "themes"
  | "add"
  | "agent"
  | "review";

export const TOOL_LABEL: Record<ToolName, string> = {
  inspect: "Inspect",
  paths: "Paths",
  shock: "Shock",
  themes: "Themes",
  add: "Add",
  agent: "Agent",
  review: "Review",
};
