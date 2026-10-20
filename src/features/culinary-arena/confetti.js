/**
 * =========================================================================
 * HIỆU ỨNG PHÁO HOA & HOA GIẤY (CANVAS CONFETTI ENGINE)
 * Nhẹ, mượt mà 60fps, không phụ thuộc thư viện ngoài
 * =========================================================================
 */

export function launchConfetti(durationMs = 3500) {
    let canvas = document.getElementById('arena-confetti-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'arena-confetti-canvas';
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.width = '100vw';
        canvas.style.height = '100vh';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '9999';
        document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = [
        '#f59e0b', '#fbbf24', '#ef4444', '#f97316', '#10b981',
        '#06b6d4', '#8b5cf6', '#ec4899', '#ffffff'
    ];

    const particles = [];
    const particleCount = 140;

    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: width * 0.5 + (Math.random() - 0.5) * 200,
            y: height * 0.6,
            vx: (Math.random() - 0.5) * 18,
            vy: -Math.random() * 18 - 8,
            size: Math.random() * 8 + 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            gravity: 0.38,
            opacity: 1,
            shape: Math.random() > 0.3 ? 'rect' : 'circle'
        });
    }

    let startTime = performance.now();
    let animId = null;

    function render(now) {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, width, height);

        let aliveCount = 0;

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.985;
            p.rotation += p.rotationSpeed;

            if (elapsed > durationMs * 0.6) {
                p.opacity = Math.max(0, 1 - (elapsed - durationMs * 0.6) / (durationMs * 0.4));
            }

            if (p.opacity > 0 && p.y < height + 50) {
                aliveCount++;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;

                if (p.shape === 'rect') {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();
            }
        });

        if (elapsed < durationMs && aliveCount > 0) {
            animId = requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, width, height);
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }
    }

    animId = requestAnimationFrame(render);
}
