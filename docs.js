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

    // --- *** NEW: COPY BUTTON LOGIC *** ---
    const allPreBlocks = document.querySelectorAll('.docs-section pre');
    
    // --- *** UPDATED: SIMPLER COPY ICON *** ---
    const copyIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>`;
    const checkIcon = `<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;

    allPreBlocks.forEach(pre => {
        // 1. Create a wrapper and put the <pre> inside it
        const wrapper = document.createElement('div');
        wrapper.classList.add('relative'); // Use Tailwind's relative class
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        // 2. Create the button
        const copyButton = document.createElement('button');
        copyButton.innerHTML = copyIcon;
        copyButton.classList.add('copy-btn'); // Use the class we defined in CSS
        copyButton.setAttribute('title', 'Copy code');

        // 3. Add the button to the wrapper
        wrapper.appendChild(copyButton);

        // 4. Add the click event listener
        copyButton.addEventListener('click', () => {
            const textToCopy = pre.innerText;

            navigator.clipboard.writeText(textToCopy).then(() => {
                // Success feedback
                copyButton.innerHTML = checkIcon;
                copyButton.setAttribute('title', 'Copied!');
                
                // Revert after 2 seconds
                setTimeout(() => {
                    copyButton.innerHTML = copyIcon;
                    copyButton.setAttribute('title', 'Copy code');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                copyButton.innerHTML = 'Error';
                // Revert after 2 seconds
                setTimeout(() => {
                    copyButton.innerHTML = copyIcon;
                    copyButton.setAttribute('title', 'Copy code');
                }, 2000);
            });
        });
    });
    // --- *** END OF COPY BUTTON LOGIC *** ---

});