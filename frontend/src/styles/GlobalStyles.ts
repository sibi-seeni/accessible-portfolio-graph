import { createGlobalStyle } from "styled-components";

export const GlobalStyles = createGlobalStyle`
  :root {
    --bg-base: ${(p) => p.theme.bg};
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html,
  body,
  #root {
    height: 100%;
  }

  body {
    font-family: system-ui, sans-serif;
    background: ${(p) => p.theme.bg};
    color: ${(p) => p.theme.text};
    color-scheme: ${(p) => (p.theme.name === "workspace" ? "dark" : "light")};
  }
`;
