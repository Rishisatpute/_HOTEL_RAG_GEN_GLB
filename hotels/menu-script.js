

const menuItems = [
    {
        id: 1,
        name: 'Bruschetta al Pomodoro',
        category: 'appetizers',
        diet: 'Veg',
        price: 8.99,
        description: 'Toasted bread with fresh tomatoes, garlic, basil, and olive oil',
        image: 'images/Bruschetta al Pomodoro.jpg',
        rating: 4.5
    },
    {
        id: 2,
        name: 'Calamari Fritti',
        category: 'appetizers',
        diet: 'Non-Veg',
        price: 11.99,
        description: 'Crispy fried calamari served with marinara sauce',
        image: 'images/Calamari Fritti.jpg',
        rating: 4.3
    },
    {
        id: 3,
        name: 'Caprese Salad',
        category: 'appetizers',
        diet: 'Veg',
        price: 9.99,
        description: 'Fresh mozzarella, tomatoes, and basil with balsamic reduction',
        image: 'images/Caprese Salad.jpg',
        rating: 4.6
    },
    {
        id: 4,
        name: 'Prosciutto & Melon',
        category: 'appetizers',
        diet: 'Non-Veg',
        price: 10.99,
        description: 'Premium cured ham with fresh cantaloupe',
        image: 'images/Prosciutto & Melon.jpg',
        rating: 4.7
    },

    {
        id: 5,
        name: 'Filet Mignon',
        category: 'mains',
        diet: 'Non-Veg',
        price: 42.99,
        description: 'Premium beef tenderloin with truffle potato and seasonal vegetables',
        image: 'images/Filet Mignon.jpg',
        rating: 4.9
    },
    {
        id: 6,
        name: 'Osso Buco',
        category: 'mains',
        diet: 'Non-Veg',
        price: 38.99,
        description: 'Braised veal shank with saffron risotto and gremolata',
        image: 'images/Osso Buco.jpg',
        rating: 4.8
    },
    {
        id: 7,
        name: 'Lamb Chops',
        category: 'mains',
        diet: 'Non-Veg',
        price: 39.99,
        description: 'Herb-crusted lamb chops with rosemary jus and root vegetables',
        image: 'images/Lamb Chops.webp',
        rating: 4.7
    },
    {
        id: 8,
        name: 'Duck Confit',
        category: 'mains',
        diet: 'Non-Veg',
        price: 35.99,
        description: 'Slow-cooked duck leg with cherry gastrique',
        image: 'images/Duck Confit.jpg',
        rating: 4.6
    },
    
    
    {
        id: 9,
        name: 'Pan-Seared Salmon',
        category: 'seafood',
        diet: 'Non-Veg',
        price: 32.99,
        description: 'Atlantic salmon with lemon beurre blanc and asparagus',
        image: 'images/Pan-Seared Salmon.jpg',
        rating: 4.7
    },
    {
        id: 10,
        name: 'Lobster Tail',
        category: 'seafood',
        diet: 'Non-Veg',
        price: 45.99,
        description: 'Cold water lobster tail with drawn butter and herb oil',
        image: 'images/Lobster Tail.jpg',
        rating: 4.9
    },
    {
        id: 11,
        name: 'Branzino',
        category: 'seafood',
        diet: 'Non-Veg',
        price: 34.99,
        description: 'Mediterranean sea bass with herbs, lemon, and roasted fennel',
        image: 'images/Branzino.jpg',
        rating: 4.5
    },
    {
        id: 12,
        name: 'Shrimp Scampi',
        category: 'seafood',
        diet: 'Non-Veg',
        price: 28.99,
        description: 'Garlic butter shrimp over linguine with fresh parsley',
        image: 'images/Shrimp Scampi.jpg',
        rating: 4.6
    },
    
    
    {
        id: 13,
        name: 'Carbonara Classico',
        category: 'pasta',
        diet: 'Non-Veg',
        price: 22.99,
        description: 'Handmade spaghetti with guanciale, egg, and pecorino romano',
        image: 'images/Carbonara Classico.jpg',
        rating: 4.8
    },
    {
        id: 14,
        name: 'Truffle Fettuccine',
        category: 'pasta',
        diet: 'Veg',
        price: 28.99,
        description: 'Fresh fettuccine with black truffle and aged parmigiano',
        image: 'images/Truffle Fettuccine.jpg',
        rating: 4.9
    },
    {
        id: 15,
        name: 'Risotto Milanese',
        category: 'pasta',
        diet: 'Veg',
        price: 24.99,
        description: 'Creamy saffron risotto with mushrooms and parmesan',
        image: 'images/Risotto Milanese.jpg',
        rating: 4.7
    },
    {
        id: 16,
        name: 'Bolognese',
        category: 'pasta',
        diet: 'Non-Veg',
        price: 20.99,
        description: 'Classic tagliatelle with slow-cooked meat ragù',
        image: 'images/Bolognese.jpg',
        rating: 4.6
    },
    
    
    {
        id: 17,
        name: 'Tiramisu',
        category: 'desserts',
        diet: 'Veg',
        price: 8.99,
        description: 'Traditional Italian dessert with mascarpone and espresso',
        image: 'images/Tiramisu.jpg',
        rating: 4.8
    },
    {
        id: 18,
        name: 'Panna Cotta',
        category: 'desserts',
        diet: 'Veg',
        price: 7.99,
        description: 'Silky vanilla cream with berry coulis',
        image: 'images/Panna Cotta.jpg',
        rating: 4.7
    },
    {
        id: 19,
        name: 'Chocolate Lava Cake',
        category: 'desserts',
        diet: 'Veg',
        price: 9.99,
        description: 'Warm chocolate cake with molten center and vanilla ice cream',
        image: 'images/Chocolate Lava Cake.jpg',
        rating: 4.9
    },
    {
        id: 20,
        name: 'Gelato Selection',
        category: 'desserts',
        diet: 'Veg',
        price: 6.99,
        description: 'Choose from pistachio, chocolate, hazelnut, or seasonal flavors',
        image: 'images/Gelato Selection.jpg',
        rating: 4.6
    },
    
    
    {
        id: 21,
        name: 'Red Wine Selection',
        category: 'beverages',
        diet: 'Veg',
        price: 12.00,
        description: 'Curated Italian and French red wines by the glass',
        image: 'images/Red Wine Selection.png',
        rating: 4.5
    },
    {
        id: 22,
        name: 'White Wine Selection',
        category: 'beverages',
        diet: 'Veg',
        price: 11.00,
        description: 'Fresh and crisp white wines from renowned vineyards',
        image: 'images/White Wine Selection.jpg',
        rating: 4.4
    },
    {
        id: 23,
        name: 'Craft Cocktails',
        category: 'beverages',
        diet: 'Veg',
        price: 12.99,
        description: 'House-made specialty cocktails with premium spirits',
        image: 'images/Craft Cocktails.jpg',
        rating: 4.6
    },
    {
        id: 24,
        name: 'Italian Espresso',
        category: 'beverages',
        diet: 'Veg',
        price: 3.99,
        description: 'Authentic Italian espresso, cappuccino, and specialty coffees',
        image: 'images/Italian Espresso.jpg',
        rating: 4.7
    }
];

const CATEGORY_IMAGES = {
    appetizers: 'https://images.unsplash.com/photo-1601050693847-776927d543f5?w=600&q=80',
    mains: 'https://images.unsplash.com/photo-1546837219-4ac7ab081606?w=600&q=80',
    seafood: 'https://images.unsplash.com/photo-1519708223418-c8fd9a32b3a2?w=600&q=80',
    pasta: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d11a?w=600&q=80',
    desserts: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&q=80',
    beverages: 'https://images.unsplash.com/photo-1514362542647-60166589c952?w=600&q=80'
};

function getItemImage(item) {
    return item.image || CATEGORY_IMAGES[item.category] || CATEGORY_IMAGES.mains;
}

function renderStars(rating) {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fas fa-star"></i>';
    if (half) html += '<i class="fas fa-star-half-alt"></i>';
    return html;
}

const menuGrid = document.getElementById('menuGrid');
const noItemsMessage = document.getElementById('noItems');


const filterBtns = document.querySelectorAll('.filter-btn');
const priceRadios = document.querySelectorAll('input[name="price"]');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const resetFiltersBtn = document.getElementById('resetFilters');

const CATEGORY_LABELS = {
    appetizers: 'Appetizers',
    mains: 'Main Course',
    seafood: 'Seafood',
    pasta: 'Pasta',
    desserts: 'Desserts',
    beverages: 'Beverages'
};

let currentFilters = { category: 'all', price: 'all', search: '', sort: 'featured' };



document.addEventListener('DOMContentLoaded', () => {
    renderMenuItems(menuItems);
    document.getElementById('cartNavLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.orderSystem?.openDrawer();
    });
    sortSelect?.addEventListener('change', (e) => {
        currentFilters.sort = e.target.value;
        applyFilters();
    });
});



function renderMenuItems(items) {
    if (items.length === 0) {
        menuGrid.style.display = 'none';
        noItemsMessage.style.display = 'block';
        return;
    }

    menuGrid.style.display = 'grid';
    noItemsMessage.style.display = 'none';
    menuGrid.innerHTML = '';

    items.forEach(item => {
        const card = createMenuCard(item);
        menuGrid.appendChild(card);
    });
}

function createMenuCard(item) {
    const os = window.orderSystem;
    const qty = os ? os.getCardQty(item.id) : 1;
    const img = getItemImage(item);
    const dietLabel = item.diet || 'Non-Veg';
    const popularBadge = item.rating >= 4.8 ? '<span class="card-featured-badge">Best Seller</span>' : '';
    const card = document.createElement('article');
    card.className = 'menu-card-premium reveal visible';
    card.dataset.id = item.id;
    card.innerHTML = `
        <div class="card-img-wrap">
            <img src="${img}" alt="${item.name}" loading="lazy">
            <div class="card-img-overlay"></div>
            <span class="card-price-badge">€${item.price.toFixed(2)}</span>
        </div>
        <div class="card-body">
            <div class="card-badges">
                <span class="card-type-badge">${dietLabel}</span>
                ${popularBadge}
            </div>
            <span class="card-category-tag">${CATEGORY_LABELS[item.category] || item.category}</span>
            <h3>${item.name}</h3>
            <p class="card-desc">${item.description}</p>
            <div class="card-rating">${renderStars(item.rating)} <span class="card-rating-value">${item.rating.toFixed(1)}</span></div>
            <div class="card-qty-row">
                <span class="card-qty-label">Quantity</span>
                <div class="qty-control">
                    <button type="button" class="qty-minus" aria-label="Decrease"><i class="fas fa-minus"></i></button>
                    <span class="qty-val">${qty}</span>
                    <button type="button" class="qty-plus" aria-label="Increase"><i class="fas fa-plus"></i></button>
                </div>
            </div>
            <div class="card-actions">
                <button type="button" class="btn-add"><i class="fas fa-plus"></i> Add to Cart</button>
            </div>
        </div>
    `;

    const enriched = { ...item, image: img };

    card.querySelector('.qty-minus').addEventListener('click', () => {
        const q = Math.max(1, (os?.getCardQty(item.id) || 1) - 1);
        os?.setCardQty(item.id, q);
        card.querySelector('.qty-val').textContent = q;
    });
    card.querySelector('.qty-plus').addEventListener('click', () => {
        const q = (os?.getCardQty(item.id) || 1) + 1;
        os?.setCardQty(item.id, q);
        card.querySelector('.qty-val').textContent = q;
    });
    card.querySelector('.btn-add').addEventListener('click', () => {
        os?.addToCart(enriched, os.getCardQty(item.id));
        os?.openDrawer();
    });

    return card;
}


filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilters.category = btn.dataset.category;
        applyFilters();
    });
});

priceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        currentFilters.price = radio.value;
        applyFilters();
    });
});

searchInput.addEventListener('input', (e) => {
    currentFilters.search = e.target.value.toLowerCase();
    applyFilters();
});

resetFiltersBtn.addEventListener('click', () => {
    currentFilters = { category: 'all', price: 'all', search: '', sort: 'featured' };
    filterBtns.forEach(b => b.classList.remove('active'));
    filterBtns[0].classList.add('active');
    priceRadios[0].checked = true;
    searchInput.value = '';
    if (sortSelect) sortSelect.value = 'featured';
    applyFilters();
});

function applyFilters() {
    let filtered = menuItems;

    
    if (currentFilters.category !== 'all') {
        filtered = filtered.filter(item => item.category === currentFilters.category);
    }

    
    if (currentFilters.price !== 'all') {
        const [min, max] = currentFilters.price.split('-');
        if (max === undefined) {
            filtered = filtered.filter(item => item.price >= parseFloat(min));
        } else {
            filtered = filtered.filter(item => item.price >= parseFloat(min) && item.price <= parseFloat(max));
        }
    }

    
    if (currentFilters.search) {
        filtered = filtered.filter(item =>
            item.name.toLowerCase().includes(currentFilters.search) ||
            item.description.toLowerCase().includes(currentFilters.search)
        );
    }

    filtered = sortMenuItems(filtered);
    renderMenuItems(filtered);
}

function sortMenuItems(items) {
    const sorted = [...items];
    if (currentFilters.sort === 'price-low') {
        sorted.sort((a, b) => a.price - b.price);
    } else if (currentFilters.sort === 'price-high') {
        sorted.sort((a, b) => b.price - a.price);
    } else if (currentFilters.sort === 'popular') {
        sorted.sort((a, b) => b.rating - a.rating);
    }
    return sorted;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        window.orderSystem?.closeDrawer();
        window.orderSystem?.closePlaceOrderModal();
    }
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        searchInput?.focus();
    }
});
