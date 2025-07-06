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


// Medium Blog Integration
class MediumBlogIntegration {
    constructor() {
        this.username = 'saloni.balkondekar';
        this.apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=https://medium.com/feed/@${this.username}`;
        this.maxArticles = 3;
        this.blogContainer = document.getElementById('blog-articles');
        this.init();
    }

    init() {
        this.fetchBlogPosts();
    }

    async fetchBlogPosts() {
        try {
            const response = await fetch(this.apiUrl);
            const data = await response.json();
            
            if (data.status === 'ok' && data.items) {
                this.renderBlogPosts(data.items.slice(0, this.maxArticles));
            } else {
                throw new Error('Failed to fetch blog posts');
            }
        } catch (error) {
            console.error('Error fetching Medium posts:', error);
            this.showError();
        }
    }

    renderBlogPosts(posts) {
        const blogHtml = posts.map(post => {
            const publishDate = new Date(post.pubDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            const readTime = this.calculateReadTime(post.content);
            const excerpt = this.extractExcerpt(post.content);
            const thumbnail = this.extractThumbnail(post);
            
            return `
                <article class="blog-article clickable-article" 
                         data-url="${post.link}" 
                         data-track="blog-article" 
                         data-title="${post.title.replace(/"/g, '&quot;')}"
                         data-date="${publishDate}">
                    ${thumbnail ? `
                        <div class="blog-article-image">
                            <img src="${thumbnail}" alt="${post.title}" loading="lazy">
                        </div>
                    ` : ''}
                    <div class="blog-article-content">
                        <h4 class="blog-article-title">${post.title}</h4>
                        <p class="blog-article-excerpt">${excerpt}</p>
                        <div class="blog-article-meta">
                            <span class="blog-article-date">${publishDate}</span>
                            <span class="blog-article-read-time">${readTime} min read</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
        
        this.blogContainer.innerHTML = blogHtml;
        
        // Add click tracking for blog articles
        this.setupBlogTracking();
    }

    extractExcerpt(content) {
        // Remove HTML tags and get first 120 characters
        const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
        return plainText.length > 120 ? plainText.substring(0, 120) + '...' : plainText;
    }

    extractThumbnail(post) {
        // Medium RSS provides thumbnail in multiple ways
        if (post.thumbnail) {
            return post.thumbnail;
        }
        
        // Try to extract from content
        const imgRegex = /<img[^>]+src="([^">]+)"/i;
        const match = post.content.match(imgRegex);
        if (match) {
            return match[1];
        }
        
        // Try enclosure (some RSS feeds use this)
        if (post.enclosure && post.enclosure.link) {
            return post.enclosure.link;
        }
        
        return null;
    }

    calculateReadTime(content) {
        const wordsPerMinute = 200;
        const plainText = content.replace(/<[^>]*>/g, '');
        const wordCount = plainText.split(/\s+/).length;
        return Math.ceil(wordCount / wordsPerMinute);
    }

    setupBlogTracking() {
        const blogArticles = document.querySelectorAll('.clickable-article');
        blogArticles.forEach(article => {
            // Make entire article clickable
            article.addEventListener('click', (e) => {
                const title = article.getAttribute('data-title');
                const date = article.getAttribute('data-date');
                const url = article.getAttribute('data-url');
                
                // Track blog article click
                if (window.portfolioAnalytics) {
                    window.portfolioAnalytics.trackBlogClick({
                        title: title,
                        date: date,
                        url: url
                    });
                }
                
                // Open article in new tab
                window.open(url, '_blank');
            });
            
            // Add cursor pointer and hover effects
            article.style.cursor = 'pointer';
        });
    }

    showError() {
        this.blogContainer.innerHTML = `
            <div class="blog-error">
                Unable to load latest articles. 
                <a href="https://medium.com/@${this.username}" target="_blank" style="color: var(--color-primary);">
                    Visit Medium directly →
                </a>
            </div>
        `;
    }
}

// Enhanced Portfolio Analytics with Blog Tracking
class PortfolioAnalytics {
    constructor() {
        this.init();
        // Make analytics available globally for blog integration
        window.portfolioAnalytics = this;
    }

    init() {
        // Track page view
        this.trackPageView();
        
        // Add click tracking to all links
        this.setupLinkTracking();
        
        // Track scroll behavior
        this.setupScrollTracking();
    }

    async trackPageView() {
        try {
            await fetch('/analytics/track/pageview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    site: 'portfolio',
                    path: window.location.pathname
                })
            });
            console.log('📊 Portfolio page view tracked');
        } catch (error) {
            console.log('❌ Failed to track page view:', error);
        }
    }

    setupLinkTracking() {
        // Track all links with data-track attribute
        document.querySelectorAll('a[data-track]').forEach(link => {
            link.addEventListener('click', (e) => {
                const trackType = link.getAttribute('data-track');
                const metadata = {};
                
                // Collect additional metadata based on track type
                switch (trackType) {
                    case 'project-link':
                        metadata.project = link.getAttribute('data-project');
                        metadata.url = link.href;
                        break;
                    case 'social-link':
                        metadata.platform = link.getAttribute('data-platform');
                        metadata.url = link.href;
                        break;
                    case 'contact-link':
                        metadata.type = link.getAttribute('data-type');
                        metadata.contact = link.href;
                        break;
                    case 'blog-link':
                        metadata.type = link.getAttribute('data-type');
                        metadata.url = link.href;
                        break;
                }
                
                this.trackLinkClick(trackType, metadata);
            });
        });
    }

    async trackLinkClick(linkType, metadata) {
        try {
            await fetch('/analytics/track/link-click', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    site: 'portfolio',
                    link_type: linkType,
                    metadata: metadata,
                    timestamp: new Date().toISOString()
                })
            });
            console.log(`📊 Link click tracked: ${linkType}`, metadata);
        } catch (error) {
            console.log('❌ Failed to track link click:', error);
        }
    }

    async trackBlogClick(articleData) {
        try {
            await fetch('/analytics/track/blog-click', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    site: 'portfolio',
                    article_title: articleData.title,
                    article_date: articleData.date,
                    article_url: articleData.url,
                    timestamp: new Date().toISOString()
                })
            });
            console.log('📊 Blog article click tracked:', articleData.title);
        } catch (error) {
            console.log('❌ Failed to track blog click:', error);
        }
    }

    setupScrollTracking() {
        let maxScrollPercentage = 0;
        let scrollTimeout;

        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollPercent = Math.round(
                    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
                );
                
                if (scrollPercent > maxScrollPercentage) {
                    maxScrollPercentage = scrollPercent;
                    
                    // Track significant scroll milestones
                    if (scrollPercent >= 25 && scrollPercent < 50) {
                        this.trackScrollMilestone(25);
                    } else if (scrollPercent >= 50 && scrollPercent < 75) {
                        this.trackScrollMilestone(50);
                    } else if (scrollPercent >= 75 && scrollPercent < 90) {
                        this.trackScrollMilestone(75);
                    } else if (scrollPercent >= 90) {
                        this.trackScrollMilestone(90);
                    }
                }
            }, 100);
        });
    }

    async trackScrollMilestone(percentage) {
        try {
            await fetch('/analytics/track/scroll', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    site: 'portfolio',
                    scroll_percentage: percentage,
                    timestamp: new Date().toISOString()
                })
            });
            console.log(`📊 Scroll milestone tracked: ${percentage}%`);
        } catch (error) {
            console.log('❌ Failed to track scroll:', error);
        }
    }
}

// Initialize analytics and blog integration when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PortfolioAnalytics();
    new MediumBlogIntegration();
});
