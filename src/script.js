// Mouse glow effect
let isMouseMoving = false;
let mouseTimeout;

document.addEventListener('mousemove', function(e) {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    
    document.documentElement.style.setProperty('--mouse-x', x + '%');
    document.documentElement.style.setProperty('--mouse-y', y + '%');
    
    // Show the glow when mouse moves
    if (!isMouseMoving) {
        isMouseMoving = true;
        document.body.style.setProperty('--glow-opacity', '1');
        document.querySelector('body::before') && (document.body.style.setProperty('--glow-opacity', '1'));
    }
    
    // Hide glow after mouse stops moving
    clearTimeout(mouseTimeout);
    mouseTimeout = setTimeout(() => {
        isMouseMoving = false;
        document.body.style.setProperty('--glow-opacity', '0');
    }, 2000);
});

// Show glow on mouse enter
document.addEventListener('mouseenter', function() {
    document.body.style.setProperty('--glow-opacity', '1');
});

// Hide glow on mouse leave
document.addEventListener('mouseleave', function() {
    document.body.style.setProperty('--glow-opacity', '0');
});
