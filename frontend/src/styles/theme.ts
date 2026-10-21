import "styled-components";

export type LayoutName = "canvas" | "workspace";

export interface AppTheme {
  name: LayoutName;
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceBlur: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  shadow: string;
  focus: string;
  graph: {
    label: string;
    labelPill: string;
    sectorLabel: string;
    sectorPill: string;
    structuralEdge: string;
    proposedEdge: string;
    externalFill: string;
  };
}

// Canvas keeps the original warm, light, glassy look.
export const canvasTheme: AppTheme = {
  name: "canvas",
  bg: "#f0f0eb",
  surface: "rgba(255, 255, 255, 0.78)",
  surfaceRaised: "rgba(255, 255, 255, 0.92)",
  surfaceBlur: "blur(16px)",
  border: "rgba(26, 32, 53, 0.14)",
  borderStrong: "rgba(26, 32, 53, 0.28)",
  text: "#1a1d2e",
  textMuted: "#5d6070",
  accent: "#2f7fa0",
  accentSoft: "rgba(61, 143, 176, 0.16)",
  danger: "#c23b3b",
  dangerSoft: "rgba(220, 60, 60, 0.12)",
  success: "#2e8a5a",
  warning: "#a86d14",
  shadow: "0 8px 28px rgba(26, 32, 53, 0.12)",
  focus: "#1a1d2e",
  graph: {
    label: "#1a1d2e",
    labelPill: "rgba(240, 240, 235, 0.82)",
    sectorLabel: "#0f1117",
    sectorPill: "rgba(240, 240, 235, 0.85)",
    structuralEdge: "#b0b0b8",
    proposedEdge: "#9a9aa6",
    externalFill: "rgba(240, 240, 235, 0.95)",
  },
};

// Workspace is a dense, dark analyst layout.
export const workspaceTheme: AppTheme = {
  name: "workspace",
  bg: "#0d1117",
  surface: "#151b23",
  surfaceRaised: "#1c232d",
  surfaceBlur: "none",
  border: "#262f3b",
  borderStrong: "#3a4656",
  text: "#e6e9ef",
  textMuted: "#9aa4b2",
  accent: "#5cc0e6",
  accentSoft: "rgba(92, 192, 230, 0.14)",
  danger: "#f07171",
  dangerSoft: "rgba(240, 113, 113, 0.14)",
  success: "#5fd39a",
  warning: "#e8b45a",
  shadow: "0 8px 28px rgba(0, 0, 0, 0.45)",
  focus: "#e6e9ef",
  graph: {
    label: "#e6e9ef",
    labelPill: "rgba(21, 27, 35, 0.88)",
    sectorLabel: "#e6e9ef",
    sectorPill: "rgba(21, 27, 35, 0.9)",
    structuralEdge: "#4a5566",
    proposedEdge: "#7c8796",
    externalFill: "#0d1117",
  },
};

export const THEMES: Record<LayoutName, AppTheme> = {
  canvas: canvasTheme,
  workspace: workspaceTheme,
};

declare module "styled-components" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefaultTheme extends AppTheme {}
}
