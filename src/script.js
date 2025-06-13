// Add hover effects to social links
document.querySelectorAll('.social-links a').forEach(link => {
    link.addEventListener('mouseenter', function() {
        this.style.textShadow = '0 0 10px var(--color-primary)';
    });
    
    link.addEventListener('mouseleave', function() {
        this.style.textShadow = 'none';
    });
});

// Interactive 3D Flower with manual rotation
const geometricShape = document.querySelector('.geometric-shape');
const flowerContainer = document.querySelector('.flower-container');
const flowerPetals = document.querySelectorAll('.flower-petal');
const flowerCenter = document.querySelector('.flower-center');

let isDragging = false;
let startX = 0;
let startY = 0;
let currentRotationY = 0;
let currentRotationX = 0;

// Manual rotation with mouse drag
geometricShape.addEventListener('mousedown', function(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    this.style.cursor = 'grabbing';
    flowerContainer.style.animationPlayState = 'paused';
    // Disable hover effects during drag
    this.style.pointerEvents = 'none';
    setTimeout(() => {
        this.style.pointerEvents = 'auto';
    }, 50);
});

document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    currentRotationY += deltaX * 0.5;
    currentRotationX -= deltaY * 0.5;
    
    // Limit rotation to prevent flipping
    currentRotationX = Math.max(-45, Math.min(45, currentRotationX));
    
    flowerContainer.style.transform = `rotateY(${currentRotationY}deg) rotateX(${currentRotationX}deg)`;
    
    startX = e.clientX;
    startY = e.clientY;
});

document.addEventListener('mouseup', function() {
    if (isDragging) {
        isDragging = false;
        geometricShape.style.cursor = 'grab';
        
        // Resume animation after a delay
        setTimeout(() => {
            flowerContainer.style.animationPlayState = 'running';
            flowerContainer.style.transform = '';
            currentRotationY = 0;
            currentRotationX = 0;
        }, 1000);
    }
});

// Double click to reset
geometricShape.addEventListener('dblclick', function() {
    flowerContainer.style.transform = '';
    flowerContainer.style.animationPlayState = 'running';
    currentRotationY = 0;
    currentRotationX = 0;
});

// Individual petal click effects (simplified to reduce glitchiness)
flowerPetals.forEach((petal, index) => {
    petal.addEventListener('click', function(e) {
        if (isDragging) return; // Don't trigger during drag
        e.stopPropagation();
        
        // Simple pulse effect that preserves the original transform
        const originalTransform = this.style.transform;
        this.style.transform = originalTransform + ' scale(1.1)';
        this.style.filter = 'brightness(1.2)';
        
        setTimeout(() => {
            this.style.transform = originalTransform;
            this.style.filter = '';
        }, 300);
    });
});

// Flower center interaction
flowerCenter.addEventListener('click', function(e) {
    if (isDragging) return; // Don't trigger during drag
    e.stopPropagation();
    
    // Gentle wave effect through petals
    flowerPetals.forEach((petal, index) => {
        setTimeout(() => {
            const originalTransform = petal.style.transform;
            petal.style.transform = originalTransform + ' scale(1.08)';
            petal.style.filter = 'brightness(1.15) saturate(1.2)';
            
            setTimeout(() => {
                petal.style.transform = originalTransform;
                petal.style.filter = '';
            }, 250);
        }, index * 80);
    });
    
    // Center glow
    this.style.filter = 'brightness(1.3) drop-shadow(0 0 15px #fbbf24)';
    
    setTimeout(() => {
        this.style.filter = '';
    }, 600);
});

// Gentle mouse tracking (reduced intensity)
geometricShape.addEventListener('mousemove', function(e) {
    if (isDragging) return;
    
    const rect = this.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);
    
    const rotateX = deltaY * 3; // Further reduced for smoother interaction
    const rotateY = deltaX * 3; // Further reduced for smoother interaction
    
    if (!this.style.transform.includes('perspective')) {
        this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }
});

geometricShape.addEventListener('mouseleave', function() {
    if (!isDragging) {
        this.style.transform = '';
    }
});
