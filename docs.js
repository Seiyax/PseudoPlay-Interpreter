const themeToggle = document.getElementById('themeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const lightModeBanner = document.getElementById('lightModeBanner');
const darkModeBanner = document.getElementById('darkModeBanner');

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

document.addEventListener('DOMContentLoaded', () => {

    const accordions = document.querySelectorAll('.accordion-toggle');

    accordions.forEach((button, index) => {
        const content = button.nextElementSibling;

        const openAccordion = () => {
            button.classList.add('active');
            content.classList.add('open'); 
        };
    const closeAccordion = () => {
        button.classList.remove('active');
        content.classList.remove('open'); 
    };

        button.addEventListener('click', () => {

            if (button.classList.contains('active')) {
                closeAccordion();
            } else {
                openAccordion();

            }
        });


        if (index === 0) {
            openAccordion();
        }
    });
    

    const tocLinks = document.querySelectorAll('.toc-link');
    const sections = document.querySelectorAll('.docs-section');
    
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {

                tocLinks.forEach(link => link.classList.remove('active'));

                const id = entry.target.id;
                const correspondingLink = document.querySelector(`.toc-link[data-target="${id}"]`);
                if (correspondingLink) {
                    correspondingLink.classList.add('active');
                }
            }
        });
    }, {

        threshold: 0.5,
        rootMargin: '0px 0px -40% 0px' 
    });

    sections.forEach(section => {
        observer.observe(section);
    });


    const allPreBlocks = document.querySelectorAll('.docs-section pre');

    const copyIcon = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>`;
    const checkIcon = `<svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;

    allPreBlocks.forEach(pre => {

        const wrapper = document.createElement('div');
        wrapper.classList.add('relative'); 
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const copyButton = document.createElement('button');
        copyButton.innerHTML = copyIcon;
        copyButton.classList.add('copy-btn');
        copyButton.setAttribute('title', 'Copy code');

        wrapper.appendChild(copyButton);


        copyButton.addEventListener('click', () => {
            const textToCopy = pre.innerText;

            navigator.clipboard.writeText(textToCopy).then(() => {
                copyButton.innerHTML = checkIcon;
                copyButton.setAttribute('title', 'Copied!');
                
                setTimeout(() => {
                    copyButton.innerHTML = copyIcon;
                    copyButton.setAttribute('title', 'Copy code');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                copyButton.innerHTML = 'Error';
                setTimeout(() => {
                    copyButton.innerHTML = copyIcon;
                    copyButton.setAttribute('title', 'Copy code');
                }, 2000);
            });
        });
    });

});
