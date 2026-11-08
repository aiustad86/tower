document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.getElementById('nav-toggle');
    const navList = document.getElementById('nav-list');

    navToggle.addEventListener('click', function() {
        navList.classList.toggle('nav-list--open');
    });
});
