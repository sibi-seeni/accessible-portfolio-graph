import styled, { css, keyframes } from "styled-components";

interface BackgroundGraphProps {
  dataUrl: string;
  driftVariant: 1 | 2;
}

const drift1 = keyframes`
  0% {
    transform: translate(0px, 0px) scale(0.92);
  }
  33% {
    transform: translate(18px, -12px) scale(0.94);
  }
  66% {
    transform: translate(-12px, 16px) scale(0.91);
  }
  100% {
    transform: translate(0px, 0px) scale(0.92);
  }
`;

const drift2 = keyframes`
  0% {
    transform: translate(0px, 0px) scale(0.90);
  }
  40% {
    transform: translate(-20px, 10px) scale(0.93);
  }
  70% {
    transform: translate(14px, -18px) scale(0.89);
  }
  100% {
    transform: translate(0px, 0px) scale(0.90);
  }
`;

const Wrapper = styled.div<{ $driftVariant: 1 | 2 }>`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  opacity: 0.08;
  filter: blur(1.5px) saturate(0.4);
  will-change: transform;
  animation: ${(props) =>
    props.$driftVariant === 1
      ? css`${drift1} 25s ease-in-out infinite`
      : css`${drift2} 30s ease-in-out infinite`};
`;

const Image = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export function BackgroundGraph({
  dataUrl,
  driftVariant,
}: BackgroundGraphProps) {
  if (!dataUrl) return null;

  return (
    <Wrapper $driftVariant={driftVariant}>
      <Image src={dataUrl} alt="" />
    </Wrapper>
  );
}
