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
        e.stopPropagation();
        
        // Simple pulse effect
        this.style.transform += ' scale(1.15)';
        this.style.filter = 'brightness(1.3)';
        
        setTimeout(() => {
            this.style.transform = this.style.transform.replace(' scale(1.15)', '');
            this.style.filter = '';
        }, 400);
    });
});

// Flower center interaction
flowerCenter.addEventListener('click', function(e) {
    e.stopPropagation();
    
    // Gentle wave effect through petals
    flowerPetals.forEach((petal, index) => {
        setTimeout(() => {
            petal.style.transform += ' scale(1.1)';
            petal.style.filter = 'brightness(1.2) saturate(1.3)';
            
            setTimeout(() => {
                petal.style.transform = petal.style.transform.replace(' scale(1.1)', '');
                petal.style.filter = '';
            }, 300);
        }, index * 100);
    });
    
    // Center glow
    this.style.filter = 'brightness(1.4) drop-shadow(0 0 20px #fbbf24)';
    
    setTimeout(() => {
        this.style.filter = '';
    }, 800);
});

// Gentle mouse tracking (reduced intensity)
geometricShape.addEventListener('mousemove', function(e) {
    if (isDragging) return;
    
    const rect = this.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);
    
    const rotateX = deltaY * 5; // Reduced from 10
    const rotateY = deltaX * 5; // Reduced from 10
    
    this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

geometricShape.addEventListener('mouseleave', function() {
    if (!isDragging) {
        this.style.transform = '';
    }
});
