/* ============================================
   Ian P Stokes - Portfolio JavaScript
   Smooth animations and interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modules
    initNavigation();
    initScrollAnimations();
    initCounterAnimations();
    initSmoothScroll();
    initContactForm();
    initParallax();
});

/* Navigation */
function initNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    const nav = document.querySelector('.nav');
    const mobileLinks = document.querySelectorAll('.mobile-menu a');

    // Mobile menu toggle
    navToggle?.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
        navToggle.classList.toggle('active');
    });

    // Close mobile menu on link click
    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });

    // Nav background on scroll
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 100) {
            nav.style.background = 'rgba(10, 13, 18, 0.95)';
        } else {
            nav.style.background = 'rgba(10, 13, 18, 0.8)';
        }

        lastScroll = currentScroll;
    });

    // Active nav link highlighting
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
        let current = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;

            if (window.pageYOffset >= sectionTop && window.pageYOffset < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });
}

/* Scroll Animations */
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');

                // Stagger children animations
                const children = entry.target.querySelectorAll('.stagger-child');
                children.forEach((child, index) => {
                    child.style.transitionDelay = `${index * 0.1}s`;
                    child.classList.add('visible');
                });
            }
        });
    }, observerOptions);

    // Elements to animate
    const animateElements = document.querySelectorAll(`
        .section-header,
        .about-content p,
        .about-positioning,
        .about-image,
        .exp-card,
        .summary-card,
        .expertise-category,
        .project-card,
        .personal-note,
        .contact-info,
        .contact-form,
        .story-block,
        .dna-card,
        .principle-card,
        .timeline-header,
        .timeline-phase,
        .showcase-card,
        .career-map-wrap,
        .impact-card
    `);

    animateElements.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });
}

/* Counter Animations */
function initCounterAnimations() {
    const counters = document.querySelectorAll('[data-count]');

    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.getAttribute('data-count'));
                const suffix = counter.getAttribute('data-suffix') || '';
                animateCounter(counter, target, suffix);
                observer.unobserve(counter);
            }
        });
    }, observerOptions);

    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element, target, suffix) {
    suffix = suffix || '';
    const duration = 2000;
    const step = target / (duration / 16);
    let current = 0;

    const format = (n) => n >= 1000 ? n.toLocaleString() : String(n);

    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            element.textContent = format(target) + suffix;
            clearInterval(timer);
        } else {
            element.textContent = format(Math.floor(current)) + suffix;
        }
    }, 16);
}

/* Smooth Scroll */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* Contact Form */
function initContactForm() {
    const form = document.getElementById('contact-form');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Loading state
        submitBtn.innerHTML = 'Sending...';
        submitBtn.disabled = true;

        // Collect form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        // Simulate form submission (replace with actual endpoint)
        try {
            // For Netlify Forms, the form will work automatically
            // For custom handling, you'd send to your endpoint here
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Success
            submitBtn.innerHTML = 'Message Sent! ✓';
            submitBtn.style.background = '#10b981';
            form.reset();

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
            }, 3000);

        } catch (error) {
            submitBtn.innerHTML = 'Error - Try Again';
            submitBtn.style.background = '#ef4444';

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
            }, 3000);
        }
    });
}

/* Parallax Effect */
function initParallax() {
    const hero = document.querySelector('.hero');

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.3;

        if (hero && scrolled < window.innerHeight) {
            hero.style.transform = `translateY(${rate}px)`;
        }
    });
}

/* Utility: Throttle function */
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/* Typing Effect for Hero (optional enhancement) */
function initTypingEffect() {
    const text = document.querySelector('.hero-title .accent-text');
    if (!text) return;

    const words = ['Problem Solver', 'Innovator', 'Builder', 'Leader'];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentWord = words[wordIndex];

        if (isDeleting) {
            text.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            text.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }

        let typeSpeed = isDeleting ? 50 : 100;

        if (!isDeleting && charIndex === currentWord.length) {
            typeSpeed = 2000;
            isDeleting = true;
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            typeSpeed = 500;
        }

        setTimeout(type, typeSpeed);
    }

    // Uncomment to enable typing effect
    // type();
}

/* Console Easter Egg */
console.log(`
%c IPS.
%c Engineering Excellence, Delivered.
%c ─────────────────────────────────
  Looking at the code?
  That's the engineering mindset I appreciate.

  Let's connect: ian@ianpstokes.com
`,
'color: #00b4d8; font-size: 24px; font-weight: bold;',
'color: #94a3b8; font-size: 14px;',
'color: #64748b; font-size: 12px;'
);
