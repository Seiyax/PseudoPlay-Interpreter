// --- ELEMENTS ---
const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const lightModeBanner = document.getElementById('lightModeBanner');
const darkModeBanner = document.getElementById('darkModeBanner');

// --- THEME LOGIC ---
function setTheme(dark) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  
  if (sunIcon && moonIcon) {
    sunIcon.classList.toggle('hidden', !dark);
    moonIcon.classList.toggle('hidden', dark);
  }

  if (lightModeBanner && darkModeBanner) {
    if (dark) {
      lightModeBanner.classList.add('hidden');
      darkModeBanner.classList.remove('hidden');
    } else {
      lightModeBanner.classList.remove('hidden');
      darkModeBanner.classList.add('hidden');
    }
  }
}

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme) {
    setTheme(savedTheme === 'dark');
} else {
    setTheme(prefersDark);
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        setTheme(!document.documentElement.classList.contains('dark'));
    });
}

// --- NEW: Run all JS after the page is loaded ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- UPDATED: Smooth Accordion Logic ---
    const accordions = document.querySelectorAll('.accordion-toggle');

    accordions.forEach((button, index) => {
        const content = button.nextElementSibling;

        // Function to open a specific accordion
        const openAccordion = () => {
            button.classList.add('active');
            content.classList.add('open'); // Just add the 'open' class
        };
    
    // Function to close a specific accordion
    const closeAccordion = () => {
        button.classList.remove('active');
        content.classList.remove('open'); // <-- This is still correct
    };

        button.addEventListener('click', () => {
            // Check if it's already open
            if (button.classList.contains('active')) {
                closeAccordion();
            } else {
                openAccordion();
                
                // --- Optional: Close all others ---
                // accordions.forEach(otherButton => {
                //     if (otherButton !== button) {
                //         otherButton.classList.remove('active');
                //         otherButton.nextElementSibling.classList.remove('open');
                //     }
                // });
            }
        });

        // --- NEW: Open the first accordion by default ---
        if (index === 0) {
            openAccordion();
        }
    });
    
    // --- NEW: Scroll Spy Logic ---
    const tocLinks = document.querySelectorAll('.toc-link');
    const sections = document.querySelectorAll('.docs-section');
    
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove active from all
                tocLinks.forEach(link => link.classList.remove('active'));
                
                // Add active to the one in view
                const id = entry.target.id;
                const correspondingLink = document.querySelector(`.toc-link[data-target="${id}"]`);
                if (correspondingLink) {
                    correspondingLink.classList.add('active');
                }
            }
        });
    }, {
        // Triggers when 50% of the section is in view
        threshold: 0.5,
        // Adjust rootMargin to trigger a bit earlier/later
        // e.g., "-50px 0px -50% 0px"
        rootMargin: '0px 0px -40% 0px' 
    });

    sections.forEach(section => {
        observer.observe(section);
    });

});
