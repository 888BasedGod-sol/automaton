'use client';

import { useEffect, useRef } from 'react';

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      initParticles();
    };

    window.addEventListener('resize', handleResize);

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      
      constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 2 + 1;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > w) this.vx *= -1;
        if (this.y < 0 || this.y > h) this.vy *= -1;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139, 92, 246, 0.1)'; // accent color opacity
        ctx.fill();
      }
    }

    class Packet {
      x: number;
      y: number;
      target: Particle;
      speed: number;
      progress: number;
      startX: number;
      startY: number;

      constructor(start: Particle, end: Particle) {
        this.startX = start.x;
        this.startY = start.y;
        this.target = end;
        this.x = start.x;
        this.y = start.y;
        this.speed = 0.02 + Math.random() * 0.03;
        this.progress = 0;
      }

      update() {
        this.progress += this.speed;
        this.x = this.startX + (this.target.x - this.startX) * this.progress;
        this.y = this.startY + (this.target.y - this.startY) * this.progress;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#fff';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    let packets: Packet[] = [];

    const initParticles = () => {
      particles = [];
      const particleCount = Math.min(Math.floor((w * h) / 15000), 150); // Cap particles for performance
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      
      // Update and draw particles
      particles.forEach(p => {
        p.update();
        p.draw();
      });

      // Draw connections
      particles.forEach((p1, i) => {
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.15 * (1 - distance / 150)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Randomly spawn packet
            if (Math.random() < 0.0005) {
              packets.push(new Packet(p1, p2));
            }
          }
        }
      });

      // Update and draw packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.update();
        p.draw();
        if (p.progress >= 1) {
          packets.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    initParticles();
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}
