const toggle = document.getElementById('theme-toggle');

    toggle.addEventListener('change', () => {
        document.body.classList.toggle('dark-mode');
    });