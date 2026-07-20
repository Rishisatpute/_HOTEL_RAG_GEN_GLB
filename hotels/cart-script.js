// ==========================================
// SHOPPING CART CLASS
// ==========================================

class ShoppingCart {
    constructor(storageKey = 'shoppingCart') {
        this.storageKey = storageKey;
        this.items = [];
        this.discounts = {
            'WELCOME10': { type: 'percentage', value: 10 },
            'SAVE20': { type: 'percentage', value: 20 },
            'FLAT5': { type: 'fixed', value: 5 },
            'FREESHIP': { type: 'shipping', value: 0 }
        };
        this.appliedDiscount = null;
        this.shippingCost = 5;
        this.taxRate = 0.1;
        this.loadFromStorage();
    }

    // ==========================================
    // ADD TO CART
    // ==========================================

    addItem(product) {
        if (!product.id || !product.name || !product.price) {
            console.error('Invalid product object');
            return false;
        }

        const existingItem = this.items.find(item => item.id === product.id);

        if (existingItem) {
            existingItem.quantity += product.quantity || 1;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                description: product.description || '',
                price: parseFloat(product.price),
                quantity: product.quantity || 1,
                icon: product.icon || '📦'
            });
        }

        this.saveToStorage();
        return true;
    }

    // ==========================================
    // REMOVE FROM CART
    // ==========================================

    removeItem(productId) {
        const index = this.items.findIndex(item => item.id === productId);
        if (index > -1) {
            this.items.splice(index, 1);
            this.saveToStorage();
            return true;
        }
        return false;
    }

    // ==========================================
    // UPDATE QUANTITY
    // ==========================================

    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.id === productId);

        if (!item) {
            return false;
        }

        if (quantity <= 0) {
            return this.removeItem(productId);
        }

        item.quantity = Math.floor(quantity);
        this.saveToStorage();
        return true;
    }

    // ==========================================
    // INCREASE/DECREASE QUANTITY
    // ==========================================

    increaseQuantity(productId, amount = 1) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            return this.updateQuantity(productId, item.quantity + amount);
        }
        return false;
    }

    decreaseQuantity(productId, amount = 1) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            return this.updateQuantity(productId, item.quantity - amount);
        }
        return false;
    }

    // ==========================================
    // PRICE CALCULATIONS
    // ==========================================

    getSubtotal() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    getShipping() {
        const subtotal = this.getSubtotal();
        // Free shipping for orders over $50
        return subtotal >= 50 ? 0 : this.shippingCost;
    }

    getTax() {
        return this.getSubtotal() * this.taxRate;
    }

    getDiscount() {
        if (!this.appliedDiscount) {
            return 0;
        }

        const discount = this.discounts[this.appliedDiscount];
        if (!discount) {
            return 0;
        }

        if (discount.type === 'percentage') {
            return this.getSubtotal() * (discount.value / 100);
        } else if (discount.type === 'fixed') {
            return discount.value;
        } else if (discount.type === 'shipping') {
            return this.getShipping();
        }

        return 0;
    }

    getTotal() {
        const subtotal = this.getSubtotal();
        const shipping = this.getShipping();
        const tax = this.getTax();
        const discount = this.getDiscount();

        return subtotal + shipping + tax - discount;
    }

    // ==========================================
    // COUPON MANAGEMENT
    // ==========================================

    applyCoupon(code) {
        const upperCode = code.toUpperCase().trim();

        if (!this.discounts[upperCode]) {
            return {
                success: false,
                message: 'Invalid coupon code'
            };
        }

        this.appliedDiscount = upperCode;
        this.saveToStorage();

        return {
            success: true,
            message: `Coupon "${upperCode}" applied successfully!`,
            discount: this.getDiscount()
        };
    }

    removeCoupon() {
        this.appliedDiscount = null;
        this.saveToStorage();
    }

    // ==========================================
    // CART MANAGEMENT
    // ==========================================

    isEmpty() {
        return this.items.length === 0;
    }

    getItemCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    getUniqueItemCount() {
        return this.items.length;
    }

    getItems() {
        return [...this.items];
    }

    clearCart() {
        this.items = [];
        this.appliedDiscount = null;
        this.saveToStorage();
    }

    // ==========================================
    // LOCAL STORAGE
    // ==========================================

    saveToStorage() {
        const data = {
            items: this.items,
            appliedDiscount: this.appliedDiscount
        };
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    loadFromStorage() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.items = data.items || [];
                this.appliedDiscount = data.appliedDiscount || null;
            } catch (e) {
                console.error('Error loading cart from storage:', e);
            }
        }
    }

    // ==========================================
    // SUMMARY
    // ==========================================

    getSummary() {
        return {
            itemCount: this.getItemCount(),
            uniqueCount: this.getUniqueItemCount(),
            subtotal: this.getSubtotal(),
            shipping: this.getShipping(),
            tax: this.getTax(),
            discount: this.getDiscount(),
            discountCode: this.appliedDiscount,
            total: this.getTotal(),
            items: this.getItems()
        };
    }
}

// ==========================================
// PRODUCT DATA
// ==========================================

const PRODUCTS = [
    {
        id: 1,
        name: 'Pasta Carbonara',
        description: 'Classic Italian pasta',
        price: 14.99,
        icon: '🍝'
    },
    {
        id: 2,
        name: 'Grilled Salmon',
        description: 'Fresh Atlantic salmon',
        price: 24.99,
        icon: '🐟'
    },
    {
        id: 3,
        name: 'Beef Steak',
        description: 'Premium ribeye steak',
        price: 34.99,
        icon: '🥩'
    },
    {
        id: 4,
        name: 'Margherita Pizza',
        description: 'Traditional wood-fired pizza',
        price: 16.99,
        icon: '🍕'
    },
    {
        id: 5,
        name: 'Shrimp Tempura',
        description: 'Crispy fried shrimp',
        price: 18.99,
        icon: '🦐'
    },
    {
        id: 6,
        name: 'Chocolate Cake',
        description: 'Decadent chocolate dessert',
        price: 8.99,
        icon: '🍰'
    },
    {
        id: 7,
        name: 'Caesar Salad',
        description: 'Fresh garden salad',
        price: 10.99,
        icon: '🥗'
    },
    {
        id: 8,
        name: 'Lobster Tail',
        description: 'Butter-poached lobster',
        price: 42.99,
        icon: '🦞'
    }
];

// ==========================================
// UI MANAGEMENT
// ==========================================

class CartUI {
    constructor(cart) {
        this.cart = cart;
        this.cartItemsContainer = document.getElementById('cartItems');
        this.notification = document.getElementById('notification');
        this.productsGrid = document.getElementById('productsGrid');
    }

    renderCart() {
        if (this.cart.isEmpty()) {
            this.renderEmptyCart();
        } else {
            this.renderCartItems();
        }
        this.updateSummary();
    }

    renderEmptyCart() {
        this.cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-shopping-cart"></i>
                <p>Your cart is empty</p>
                <a href="#products-section" class="btn btn-primary">Continue Shopping</a>
            </div>
        `;
    }

    renderCartItems() {
        this.cartItemsContainer.innerHTML = this.cart.getItems().map(item => `
            <div class="cart-item">
                <div class="item-image">${item.icon}</div>
                <div class="item-details">
                    <div class="item-name">${item.name}</div>
                    <div class="item-description">${item.description}</div>
                    <div class="item-price">$${item.price.toFixed(2)}</div>
                </div>
                <div class="item-controls">
                    <div class="item-total">$${(item.price * item.quantity).toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="decreaseQuantity(${item.id})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <div class="quantity-display">${item.quantity}</div>
                        <button class="quantity-btn" onclick="increaseQuantity(${item.id})">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="remove-btn" onclick="removeItem(${item.id})" title="Remove item">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateSummary() {
        const summary = this.cart.getSummary();

        document.getElementById('subtotal').textContent = `$${summary.subtotal.toFixed(2)}`;
        document.getElementById('shipping').textContent = `$${summary.shipping.toFixed(2)}`;
        document.getElementById('tax').textContent = `$${summary.tax.toFixed(2)}`;
        document.getElementById('total').textContent = `$${summary.total.toFixed(2)}`;
        document.getElementById('itemCount').textContent = summary.itemCount;
        document.getElementById('uniqueCount').textContent = summary.uniqueCount;

        // Show/hide discount row
        const discountRow = document.getElementById('discountRow');
        if (summary.discount > 0) {
            document.getElementById('discount').textContent = `-$${summary.discount.toFixed(2)}`;
            discountRow.style.display = 'flex';
        } else {
            discountRow.style.display = 'none';
        }
    }

    renderProducts() {
        this.productsGrid.innerHTML = PRODUCTS.map(product => `
            <div class="product-card">
                <div class="product-image">${product.icon}</div>
                <div class="product-name">${product.name}</div>
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <button class="product-btn" onclick="addProduct(${product.id})">Add to Cart</button>
            </div>
        `).join('');
    }

    showNotification(message, type = 'success') {
        this.notification.textContent = message;
        this.notification.className = `notification show ${type}`;
        setTimeout(() => {
            this.notification.classList.remove('show');
        }, 3000);
    }
}

// ==========================================
// GLOBAL INSTANCES
// ==========================================

const cart = new ShoppingCart('restaurantCart');
const cartUI = new CartUI(cart);

// ==========================================
// EVENT HANDLERS
// ==========================================

function addProduct(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (product) {
        cart.addItem(product);
        cartUI.renderCart();
        cartUI.showNotification(`${product.name} added to cart!`);
    }
}

function removeItem(productId) {
    cart.removeItem(productId);
    cartUI.renderCart();
    cartUI.showNotification('Item removed from cart');
}

function increaseQuantity(productId) {
    cart.increaseQuantity(productId);
    cartUI.renderCart();
}

function decreaseQuantity(productId) {
    cart.decreaseQuantity(productId);
    cartUI.renderCart();
}

function applyCoupon() {
    const code = document.getElementById('couponCode').value;
    if (!code.trim()) {
        cartUI.showNotification('Please enter a coupon code', 'warning');
        return;
    }

    const result = cart.applyCoupon(code);
    cartUI.showNotification(result.message, result.success ? 'success' : 'error');

    if (result.success) {
        document.getElementById('couponCode').value = '';
        cartUI.renderCart();
    }
}

function clearCart() {
    if (confirm('Are you sure you want to clear the entire cart?')) {
        cart.clearCart();
        cartUI.renderCart();
        cartUI.showNotification('Cart cleared');
    }
}

function checkout() {
    if (cart.isEmpty()) {
        cartUI.showNotification('Your cart is empty', 'warning');
        return;
    }

    const summary = cart.getSummary();
    alert(`Order Summary:\n\nSubtotal: $${summary.subtotal.toFixed(2)}\nShipping: $${summary.shipping.toFixed(2)}\nTax: $${summary.tax.toFixed(2)}\nDiscount: -$${summary.discount.toFixed(2)}\n\nTotal: $${summary.total.toFixed(2)}\n\nProceeding to checkout...`);

    // Here you would normally redirect to checkout page
    console.log('Checkout:', summary);
}

function continueShopping() {
    document.querySelector('.products-section').scrollIntoView({ behavior: 'smooth' });
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Render initial UI
    cartUI.renderCart();
    cartUI.renderProducts();

    // Event listeners
    document.getElementById('applyCoupon').addEventListener('click', applyCoupon);
    document.getElementById('couponCode').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyCoupon();
        }
    });

    document.getElementById('clearCart').addEventListener('click', clearCart);
    document.getElementById('checkoutBtn').addEventListener('click', checkout);
    document.getElementById('continueShopping').addEventListener('click', continueShopping);

    // Allow adding items by pressing Enter in product cards
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList.contains('coupon-input')) {
            applyCoupon();
        }
    });

    console.log('Shopping Cart initialized');
    console.log('Available coupon codes:', Object.keys(cart.discounts).join(', '));
});

// ==========================================
// CONSOLE API FOR TESTING
// ==========================================

console.log('%c🛒 Shopping Cart API', 'color: #d4af37; font-size: 16px; font-weight: bold;');
console.log('Available methods:');
console.log('  cart.addItem(product)');
console.log('  cart.removeItem(productId)');
console.log('  cart.updateQuantity(productId, quantity)');
console.log('  cart.increaseQuantity(productId)');
console.log('  cart.decreaseQuantity(productId)');
console.log('  cart.applyCoupon(code)');
console.log('  cart.getTotal()');
console.log('  cart.getSummary()');
console.log('  cart.clearCart()');
console.log('\nExample: cart.applyCoupon("WELCOME10")');
