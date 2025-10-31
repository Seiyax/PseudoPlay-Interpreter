// --- This is a minimal script for the docs page ---
// --- It only handles theme switching and accordions ---

// --- ELEMENTS ---
const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const lightModeBanner = document.getElementById('lightModeBanner');
const darkModeBanner = document.getElementById('darkModeBanner');

function setTheme(dark) {
  // Toggle dark class on the <html> element
  document.documentElement.classList.toggle('dark', dark);
  
  // Save the user's preference to localStorage
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  
  // Toggle the icons
  if (sunIcon && moonIcon) {
    sunIcon.classList.toggle('hidden', !dark);
    moonIcon.classList.toggle('hidden', dark);
  }

  // Toggle the header banners
  if (lightModeBanner && darkModeBanner) {
    if (dark) {
      // DARK MODE
      lightModeBanner.classList.add('hidden');
      darkModeBanner.classList.remove('hidden');
    } else {
      // LIGHT MODE
      lightModeBanner.classList.remove('hidden');
      darkModeBanner.classList.add('hidden');
    }
  }
}

// --- INITIALIZE THEME ---

// Check for a saved theme in localStorage
const savedTheme = localStorage.getItem('theme');
// Check if the user's OS prefers dark mode
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

if (savedTheme) {
    // If we have a saved theme, use it
    setTheme(savedTheme === 'dark');
} else {
    // Otherwise, use their OS preference
    setTheme(prefersDark);
}

// --- EVENT LISTENER ---

// Handle the theme toggle button click
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        // Toggle based on the *current* state
        setTheme(!document.documentElement.classList.contains('dark'));
    });
}

// --- NEW: Accordion Logic ---
// We wrap this in DOMContentLoaded to make sure all elements are loaded
document.addEventListener('DOMContentLoaded', () => {
    const accordions = document.querySelectorAll('.accordion-toggle');

    accordions.forEach(button => {
        button.addEventListener('click', () => {
            const content = button.nextElementSibling;

            // Toggle active state on the button (for the arrow rotation)
            button.classList.toggle('active');

            // Toggle visibility of the content
            if (content.classList.contains('hidden')) {
                // Open
                content.classList.remove('hidden');
            } else {
                // Close
                content.classList.add('hidden');
            }
        });
    });
});

