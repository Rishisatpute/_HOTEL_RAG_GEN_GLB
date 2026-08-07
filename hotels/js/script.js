document.addEventListener('DOMContentLoaded', () => {
    // 1. Hamburger Menu Toggle
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const navLinks = document.getElementById('navLinks');
    if (hamburgerBtn && navLinks) {
        hamburgerBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // 2. Sticky Navbar on Scroll
    const topNav = document.querySelector('.top-nav');
    if (topNav) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                topNav.style.boxShadow = 'var(--shadow-md)';
                topNav.style.background = 'rgba(255, 255, 255, 0.95)';
            } else {
                topNav.style.boxShadow = 'var(--shadow-sm)';
                topNav.style.background = 'rgba(252, 249, 242, 0.9)';
            }
        });
    }

    // 3. Menu Filtering, Searching, and Sorting
    const menuContainer = document.querySelector('.menu-layout');
    if (menuContainer) {
        const filterPills = document.querySelectorAll('.filter-pill');
        const searchInput = document.getElementById('menuSearch');
        const sortSelect = document.getElementById('menuSort');
        const dishCards = Array.from(document.querySelectorAll('.menu-item-card'));
        const categories = document.querySelectorAll('.menu-category-section');

        function applyFilters() {
            const activeFilter = document.querySelector('.filter-pill.active')?.getAttribute('data-filter') || 'all';
            const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';
            const sortOption = sortSelect ? sortSelect.value : 'default';

            categories.forEach(category => {
                let hasVisibleItems = false;
                const itemsList = category.querySelector('.menu-item-list');
                let items = Array.from(itemsList.querySelectorAll('.menu-item-card'));

                items.forEach(card => {
                    const type = card.getAttribute('data-type');
                    const title = card.querySelector('.dish-title').textContent.toLowerCase();
                    
                    const matchesType = activeFilter === 'all' || type === activeFilter;
                    const matchesSearch = title.includes(searchQuery);

                    if (matchesType && matchesSearch) {
                        card.style.display = 'flex';
                        hasVisibleItems = true;
                    } else {
                        card.style.display = 'none';
                    }
                });

                // Apply Sorting to visible items
                if (sortOption !== 'default') {
                    items.sort((a, b) => {
                        const priceA = parseFloat(a.querySelector('.dish-price').textContent.replace('₹', ''));
                        const priceB = parseFloat(b.querySelector('.dish-price').textContent.replace('₹', ''));
                        if (sortOption === 'price-asc') return priceA - priceB;
                        if (sortOption === 'price-desc') return priceB - priceA;
                        return 0;
                    });
                    items.forEach(card => itemsList.appendChild(card)); // Re-append in new order
                }

                category.style.display = hasVisibleItems ? 'block' : 'none';
            });
        }

        if (filterPills.length > 0) {
            filterPills.forEach(pill => {
                pill.addEventListener('click', (e) => {
                    filterPills.forEach(p => p.classList.remove('active'));
                    e.target.classList.add('active');
                    applyFilters();
                });
            });
        }

        if (searchInput) searchInput.addEventListener('input', applyFilters);
        if (sortSelect) sortSelect.addEventListener('change', applyFilters);
    }
});

// Lightbox functionality for Gallery
function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox(e) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox && (e.target.id === 'lightbox' || e.target.classList.contains('lightbox-close'))) {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}
