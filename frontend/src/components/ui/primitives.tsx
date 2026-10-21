import styled, { css, keyframes } from "styled-components";

// Theme-aware building blocks shared by both layouts.

export const Stack = styled.div<{ $gap?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${(p) => p.$gap ?? 12}px;
  min-width: 0;
`;

export const Row = styled.div<{ $gap?: number; $wrap?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${(p) => p.$gap ?? 8}px;
  flex-wrap: ${(p) => (p.$wrap ? "wrap" : "nowrap")};
  min-width: 0;
`;

export const SectionLabel = styled.div`
  color: ${(p) => p.theme.textMuted};
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.2px;
  text-transform: uppercase;
`;

export const Heading = styled.h2`
  color: ${(p) => p.theme.text};
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.1px;
`;

export const Muted = styled.p`
  color: ${(p) => p.theme.textMuted};
  font-size: 12px;
  line-height: 1.55;
`;

export const Body = styled.p`
  color: ${(p) => p.theme.text};
  font-size: 13px;
  line-height: 1.55;
`;

export const Card = styled.div<{ $interactive?: boolean; $active?: boolean }>`
  background: ${(p) => p.theme.surfaceRaised};
  border: 1px solid
    ${(p) => (p.$active ? p.theme.accent : p.theme.border)};
  border-radius: 10px;
  padding: 10px 12px;
  color: ${(p) => p.theme.text};
  font-size: 12px;
  line-height: 1.5;
  ${(p) =>
    p.$interactive &&
    css`
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      width: 100%;
      &:hover {
        border-color: ${p.theme.borderStrong};
      }
    `}
`;

const control = css`
  width: 100%;
  min-width: 0;
  font-family: inherit;
  font-size: 13px;
  color: ${(p) => p.theme.text};
  background: ${(p) => p.theme.surfaceRaised};
  border: 1px solid ${(p) => p.theme.border};
  border-radius: 8px;
  padding: 8px 10px;

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.accent};
    outline-offset: 1px;
  }

  &::placeholder {
    color: ${(p) => p.theme.textMuted};
  }
`;

export const Input = styled.input`
  ${control}
`;

export const TextArea = styled.textarea`
  ${control}
  resize: vertical;
  min-height: 72px;
  line-height: 1.5;
`;

export const Select = styled.select`
  ${control}
`;

export const FieldLabel = styled.label`
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: ${(p) => p.theme.textMuted};
  min-width: 0;
  flex: 1;
`;

export const CheckLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: ${(p) => p.theme.text};
  cursor: pointer;
`;

type ButtonVariant = "primary" | "ghost" | "danger" | "success";

export const Button = styled.button<{ $variant?: ButtonVariant; $small?: boolean }>`
  font-family: inherit;
  font-size: ${(p) => (p.$small ? 12 : 13)}px;
  font-weight: 600;
  border-radius: 8px;
  padding: ${(p) => (p.$small ? "5px 10px" : "8px 14px")};
  cursor: pointer;
  border: 1px solid transparent;
  white-space: nowrap;
  transition: background 0.15s ease, border-color 0.15s ease;

  ${(p) => {
    switch (p.$variant) {
      case "ghost":
        return css`
          background: transparent;
          color: ${p.theme.text};
          border-color: ${p.theme.border};
          &:hover:not(:disabled) {
            border-color: ${p.theme.borderStrong};
          }
        `;
      case "danger":
        return css`
          background: ${p.theme.dangerSoft};
          color: ${p.theme.danger};
          border-color: transparent;
        `;
      case "success":
        return css`
          background: ${p.theme.accentSoft};
          color: ${p.theme.success};
          border-color: transparent;
        `;
      default:
        return css`
          background: ${p.theme.accent};
          color: ${p.theme.name === "workspace" ? "#071018" : "#ffffff"};
        `;
    }
  }}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.focus};
    outline-offset: 2px;
  }
`;

export const Badge = styled.span<{ $tone?: "accent" | "warning" | "danger" | "muted" }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 650;
  letter-spacing: 0.3px;
  padding: 2px 7px;
  border-radius: 999px;
  white-space: nowrap;
  ${(p) => {
    switch (p.$tone) {
      case "warning":
        return css`
          color: ${p.theme.warning};
          background: ${p.theme.name === "workspace"
            ? "rgba(232, 180, 90, 0.14)"
            : "rgba(168, 109, 20, 0.12)"};
        `;
      case "danger":
        return css`
          color: ${p.theme.danger};
          background: ${p.theme.dangerSoft};
        `;
      case "muted":
        return css`
          color: ${p.theme.textMuted};
          background: ${p.theme.border};
        `;
      default:
        return css`
          color: ${p.theme.accent};
          background: ${p.theme.accentSoft};
        `;
    }
  }}
`;

export const ErrorText = styled.div`
  color: ${(p) => p.theme.danger};
  background: ${(p) => p.theme.dangerSoft};
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
`;

export const Divider = styled.hr`
  border: none;
  height: 1px;
  background: ${(p) => p.theme.border};
  margin: 2px 0;
`;

export const Meter = styled.div<{ $value: number; $ghost?: number }>`
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: ${(p) => p.theme.border};
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: ${(p) => Math.min(100, p.$ghost ?? 0)}%;
    background: ${(p) => p.theme.accentSoft};
  }

  &::after {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: ${(p) => Math.min(100, p.$value)}%;
    background: ${(p) => p.theme.accent};
    opacity: 0.85;
  }
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Spinner = styled.span`
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: ${spin} 0.7s linear infinite;
  vertical-align: -2px;
`;

export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
`;

export const SegmentGroup = styled.div`
  display: inline-flex;
  padding: 3px;
  gap: 2px;
  border-radius: 10px;
  background: ${(p) => p.theme.surface};
  border: 1px solid ${(p) => p.theme.border};
  backdrop-filter: ${(p) => p.theme.surfaceBlur};
`;

export const Segment = styled.button<{ $active: boolean }>`
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 11px;
  border-radius: 7px;
  border: none;
  cursor: pointer;
  color: ${(p) => (p.$active ? p.theme.text : p.theme.textMuted)};
  background: ${(p) => (p.$active ? p.theme.surfaceRaised : "transparent")};
  box-shadow: ${(p) =>
    p.$active ? "0 1px 3px rgba(0, 0, 0, 0.15)" : "none"};

  &:focus-visible {
    outline: 2px solid ${(p) => p.theme.focus};
    outline-offset: 1px;
  }
`;
