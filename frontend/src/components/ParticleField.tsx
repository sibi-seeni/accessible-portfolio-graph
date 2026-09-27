import { useEffect, useRef } from "react";
import styled from "styled-components";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulsePhase: number;
  pulseSpeed: number;
}

const PARTICLE_COUNT = 80;
const MOUSE_RADIUS = 120;
const CONNECT_DISTANCE = 140;
const EDGE_MARGIN = 10;
const MAX_VELOCITY = 0.6;
const VELOCITY_DAMPING = 0.99;

const Wrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
`;

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: 100%;
`;

function createParticles(width: number, height: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    radius: 1.2 + Math.random() * 1.3,
    opacity: 0.3 + Math.random() * 0.4,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.01 + Math.random() * 0.015,
  }));
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        mouse.current.x = event.clientX - rect.left;
        mouse.current.y = event.clientY - rect.top;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];

    const init = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
      particles = createParticles(width, height);
    };

    const updateParticle = (particle: Particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.pulsePhase += particle.pulseSpeed;

      if (particle.x < -EDGE_MARGIN) particle.x = width + EDGE_MARGIN;
      if (particle.x > width + EDGE_MARGIN) particle.x = -EDGE_MARGIN;
      if (particle.y < -EDGE_MARGIN) particle.y = height + EDGE_MARGIN;
      if (particle.y > height + EDGE_MARGIN) particle.y = -EDGE_MARGIN;

      const dx = particle.x - mouse.current.x;
      const dy = particle.y - mouse.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < MOUSE_RADIUS) {
        const force = ((MOUSE_RADIUS - distance) / MOUSE_RADIUS) * 0.4;
        const angle = Math.atan2(dy, dx);
        particle.vx += Math.cos(angle) * force * 0.05;
        particle.vy += Math.sin(angle) * force * 0.05;
      }

      particle.vx = Math.max(
        -MAX_VELOCITY,
        Math.min(MAX_VELOCITY, particle.vx)
      );
      particle.vy = Math.max(
        -MAX_VELOCITY,
        Math.min(MAX_VELOCITY, particle.vy)
      );

      particle.vx *= VELOCITY_DAMPING;
      particle.vy *= VELOCITY_DAMPING;
    };

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < CONNECT_DISTANCE) {
            const alpha = (1 - distance / CONNECT_DISTANCE) * 0.18;
            ctx.beginPath();
            ctx.strokeStyle = `rgba(220, 220, 230, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
    };

    const drawParticles = () => {
      for (const particle of particles) {
        const pulse = Math.sin(particle.pulsePhase);
        const currentRadius = particle.radius + pulse * 0.4;
        const currentOpacity = particle.opacity + pulse * 0.12;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, currentRadius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 225, ${currentOpacity * 0.08})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 225, 235, ${currentOpacity})`;
        ctx.fill();
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      for (const particle of particles) updateParticle(particle);
      drawConnections();
      drawParticles();
      animationFrameId.current = requestAnimationFrame(animate);
    };

    const observer = new ResizeObserver(() => {
      init();
    });
    observer.observe(canvas);

    init();
    animate();

    return () => {
      observer.disconnect();
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  return (
    <Wrapper>
      <Canvas ref={canvasRef} />
    </Wrapper>
  );
}
