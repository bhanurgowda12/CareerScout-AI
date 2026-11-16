import { useEffect, useRef } from 'react';

const MAX_PARTICLES = 28;
const PARTICLE_LIFETIME = 460;

function CursorEffect() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const finePointerQuery = window.matchMedia('(any-pointer: fine)');
    const hoverQuery = window.matchMedia('(any-hover: hover)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const particles = [];
    let frameId = null;
    let previousPoint = null;
    let previousFrameTime = 0;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let pixelRatio = 1;
    let particleSequence = 0;

    function resizeCanvas() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
      canvas.width = Math.round(canvasWidth * pixelRatio);
      canvas.height = Math.round(canvasHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      particles.length = 0;
      previousPoint = null;
    }

    function stopAnimation() {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      previousFrameTime = 0;
      context.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    function animate(time) {
      frameId = null;
      const elapsed = previousFrameTime
        ? Math.min(time - previousFrameTime, 32)
        : 16;
      previousFrameTime = time;
      context.clearRect(0, 0, canvasWidth, canvasHeight);

      const isDark = document.documentElement.dataset.theme === 'dark';
      const color = isDark ? '#67e8f9' : '#0e7490';
      context.fillStyle = color;
      context.shadowColor = color;
      context.shadowBlur = 8;

      let activeCount = 0;
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        particle.age += elapsed;
        if (particle.age >= particle.life) continue;

        particle.centerX += particle.driftX * elapsed;
        particle.centerY += particle.driftY * elapsed;
        particle.angle += particle.angularVelocity * elapsed;

        const progress = particle.age / particle.life;
        const opacity = (1 - progress) ** 2 * 0.62;
        const x = particle.centerX + Math.cos(particle.angle) * particle.orbitRadius;
        const y = particle.centerY + Math.sin(particle.angle) * particle.orbitRadius;

        context.globalAlpha = opacity;
        context.beginPath();
        context.arc(x, y, particle.size, 0, Math.PI * 2);
        context.fill();
        particles[activeCount] = particle;
        activeCount += 1;
      }

      particles.length = activeCount;
      context.globalAlpha = 1;
      context.shadowBlur = 0;

      if (particles.length > 0) {
        frameId = requestAnimationFrame(animate);
      } else {
        previousFrameTime = 0;
      }
    }

    function scheduleAnimation() {
      if (frameId === null && particles.length > 0) {
        frameId = requestAnimationFrame(animate);
      }
    }

    function addParticle(x, y, directionX, directionY) {
      const angle = particleSequence * 2.399963229728653;
      const directionLength = Math.hypot(directionX, directionY) || 1;
      const tangentSpeed = 0.012 + Math.random() * 0.009;
      particles.push({
        centerX: x,
        centerY: y,
        angle,
        angularVelocity: (particleSequence % 2 === 0 ? 1 : -1) * (0.0015 + Math.random() * 0.0015),
        orbitRadius: 2 + Math.random() * 6,
        driftX: (-directionY / directionLength) * tangentSpeed + (Math.random() - 0.5) * 0.012,
        driftY: (directionX / directionLength) * tangentSpeed + (Math.random() - 0.5) * 0.012,
        size: 1.1 + Math.random() * 1.2,
        age: 0,
        life: PARTICLE_LIFETIME * (0.72 + Math.random() * 0.28),
      });
      particleSequence += 1;

      if (particles.length > MAX_PARTICLES) {
        particles.splice(0, particles.length - MAX_PARTICLES);
      }
    }

    function handlePointerMove(event) {
      if (event.pointerType !== 'mouse') return;

      const point = { x: event.clientX, y: event.clientY };
      if (!previousPoint) {
        addParticle(point.x, point.y, 0, 0);
      } else {
        const deltaX = point.x - previousPoint.x;
        const deltaY = point.y - previousPoint.y;
        const distance = Math.hypot(deltaX, deltaY);
        const steps = Math.min(3, Math.max(1, Math.ceil(distance / 18)));

        for (let step = 1; step <= steps; step += 1) {
          const progress = step / steps;
          addParticle(
            previousPoint.x + deltaX * progress,
            previousPoint.y + deltaY * progress,
            deltaX,
            deltaY,
          );
        }
      }

      previousPoint = point;
      scheduleAnimation();
    }

    function handlePointerOut(event) {
      if (!event.relatedTarget) previousPoint = null;
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        particles.length = 0;
        previousPoint = null;
        stopAnimation();
      }
    }

    function updateAvailability() {
      const enabled = finePointerQuery.matches
        && hoverQuery.matches
        && !reducedMotionQuery.matches;
      canvas.style.visibility = enabled ? 'visible' : 'hidden';
      canvas.style.opacity = enabled ? '1' : '0';

      if (enabled) {
        resizeCanvas();
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerout', handlePointerOut, { passive: true });
        window.addEventListener('resize', resizeCanvas, { passive: true });
      } else {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerout', handlePointerOut);
        window.removeEventListener('resize', resizeCanvas);
        particles.length = 0;
        previousPoint = null;
        stopAnimation();
      }
    }

    finePointerQuery.addEventListener('change', updateAvailability);
    hoverQuery.addEventListener('change', updateAvailability);
    reducedMotionQuery.addEventListener('change', updateAvailability);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    updateAvailability();

    return () => {
      finePointerQuery.removeEventListener('change', updateAvailability);
      hoverQuery.removeEventListener('change', updateAvailability);
      reducedMotionQuery.removeEventListener('change', updateAvailability);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerout', handlePointerOut);
      window.removeEventListener('resize', resizeCanvas);
      particles.length = 0;
      stopAnimation();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="cursor-effect"
      aria-hidden="true"
      style={{
        position: 'fixed',
        zIndex: 20,
        inset: 0,
        width: '100vw',
        height: '100vh',
        visibility: 'hidden',
        opacity: 0,
        transition: 'opacity 160ms ease-out',
        pointerEvents: 'none',
      }}
    />
  );
}

export default CursorEffect;
