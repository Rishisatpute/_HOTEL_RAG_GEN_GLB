// ==========================================
// FORM VALIDATION RULES
// ==========================================

const validationRules = {
    firstName: {
        required: true,
        pattern: /^[a-zA-Z\s'-]{2,}$/,
        message: 'Please enter a valid first name (at least 2 characters)'
    },
    lastName: {
        required: true,
        pattern: /^[a-zA-Z\s'-]{2,}$/,
        message: 'Please enter a valid last name (at least 2 characters)'
    },
    email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: 'Please enter a valid email address'
    },
    phone: {
        required: true,
        pattern: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/,
        message: 'Please enter a valid phone number'
    },
    address: {
        required: true,
        minLength: 5,
        message: 'Please enter a valid address'
    },
    city: {
        required: true,
        pattern: /^[a-zA-Z\s'-]{2,}$/,
        message: 'Please enter a valid city name'
    },
    state: {
        required: true,
        minLength: 2,
        message: 'Please enter a valid state/province'
    },
    zipCode: {
        required: true,
        pattern: /^[0-9]{5,10}$/,
        message: 'Please enter a valid ZIP/postal code'
    },
    country: {
        required: true,
        minLength: 2,
        message: 'Please enter a valid country'
    },
    cardName: {
        required: true,
        pattern: /^[a-zA-Z\s'-]{3,}$/,
        message: 'Please enter the cardholder name'
    },
    cardNumber: {
        required: true,
        pattern: /^[0-9\s]{19,}$/,
        message: 'Please enter a valid card number'
    },
    expiryDate: {
        required: true,
        pattern: /^(0[1-9]|1[0-2])\/\d{2}$/,
        message: 'Please enter valid expiry date (MM/YY)'
    },
    cvv: {
        required: true,
        pattern: /^[0-9]{3,4}$/,
        message: 'Please enter a valid CVV'
    },
    termsAgreed: {
        required: true,
        message: 'You must agree to the terms and conditions'
    }
};

// ==========================================
// FORM VALIDATOR CLASS
// ==========================================

class FormValidator {
    constructor(form) {
        this.form = form;
        this.errors = {};
    }

    validate(fieldName, value) {
        const rule = validationRules[fieldName];
        if (!rule) return true;

        // Check required
        if (rule.required && !value.trim()) {
            this.errors[fieldName] = rule.message;
            return false;
        }

        // Check pattern
        if (rule.pattern && value && !rule.pattern.test(value)) {
            this.errors[fieldName] = rule.message;
            return false;
        }

        // Check minLength
        if (rule.minLength && value.length < rule.minLength) {
            this.errors[fieldName] = rule.message;
            return false;
        }

        delete this.errors[fieldName];
        return true;
    }

    validateSection(sectionNumber) {
        this.errors = {};

        const section = this.form.querySelector(`fieldset[data-section="${sectionNumber}"]`);
        if (!section) return true;

        const inputs = section.querySelectorAll('input, select');
        let isValid = true;

        inputs.forEach(input => {
            if (input.type === 'checkbox' && input.id === 'sameAsBilling') {
                return; // Skip this checkbox
            }

            if (sectionNumber === 2 && !document.getElementById('sameAsBilling').checked) {
                // Validate billing fields
                if (input.id.startsWith('billing')) {
                    const value = input.type === 'checkbox' ? (input.checked ? 'on' : '') : input.value;
                    const fieldName = input.id;
                    if (!this.validate(fieldName, value)) {
                        isValid = false;
                    }
                }
            } else if (sectionNumber === 1) {
                // Validate shipping fields
                if (!input.id.startsWith('billing')) {
                    const value = input.type === 'checkbox' ? (input.checked ? 'on' : '') : input.value;
                    const fieldName = input.id;
                    if (!this.validate(fieldName, value)) {
                        isValid = false;
                    }
                }
            } else if (sectionNumber === 3) {
                // Validate payment fields
                const value = input.type === 'checkbox' ? (input.checked ? 'on' : '') : input.value;
                const fieldName = input.id;
                if (!this.validate(fieldName, value)) {
                    isValid = false;
                }
            }
        });

        this.displayErrors(section);
        return isValid;
    }

    displayErrors(section) {
        // Clear previous errors
        section.querySelectorAll('input, select').forEach(input => {
            input.classList.remove('error', 'success');
        });

        // Display new errors
        Object.keys(this.errors).forEach(fieldName => {
            const field = section.querySelector(`[name="${fieldName}"]`);
            if (field) {
                field.classList.add('error');
                const errorMsg = field.parentElement.querySelector('.error-message');
                if (errorMsg) {
                    errorMsg.textContent = this.errors[fieldName];
                }
            }
        });

        // Mark valid fields
        section.querySelectorAll('input, select').forEach(input => {
            if (!input.classList.contains('error') && input.value && input.type !== 'checkbox') {
                input.classList.add('success');
            }
        });
    }

    clearErrors(section) {
        section.querySelectorAll('input, select').forEach(input => {
            input.classList.remove('error', 'success');
            const errorMsg = input.parentElement.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.textContent = '';
            }
        });
    }
}

// ==========================================
// CHECKOUT FORM MANAGER
// ==========================================

class CheckoutFormManager {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.validator = new FormValidator(this.form);
        this.currentSection = 1;
        this.orderNumber = Math.floor(100000 + Math.random() * 900000);
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.setupCardFormatting();
        this.setupPaymentMethodToggle();
        this.setupBillingAddressToggle();
        this.loadCartSummary();
    }

    goToSection(sectionNumber) {
        if (sectionNumber < 1 || sectionNumber > 3) return;

        // Validate current section before moving
        if (sectionNumber > this.currentSection) {
            if (!this.validator.validateSection(this.currentSection)) {
                this.showNotification('Please fix the errors before continuing', 'error');
                return;
            }
        }

        // Hide current section
        document.querySelector(`.form-section[data-section="${this.currentSection}"]`)
            .classList.remove('active');

        // Show new section
        document.querySelector(`.form-section[data-section="${sectionNumber}"]`)
            .classList.add('active');

        // Update progress indicator
        this.updateProgressIndicator(sectionNumber);

        this.currentSection = sectionNumber;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateProgressIndicator(currentSection) {
        document.querySelectorAll('.progress-step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');

            if (stepNumber === currentSection) {
                step.classList.add('active');
            } else if (stepNumber < currentSection) {
                step.classList.add('completed');
            }
        });

        // Update progress lines
        document.querySelectorAll('.progress-line').forEach((line, index) => {
            if (index < currentSection - 1) {
                line.classList.add('active');
            } else {
                line.classList.remove('active');
            }
        });
    }

    setupCardFormatting() {
        const cardNumberInput = document.getElementById('cardNumber');
        if (cardNumberInput) {
            cardNumberInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\s/g, '');
                let formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                e.target.value = formatted;
            });
        }

        const expiryInput = document.getElementById('expiryDate');
        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    value = value.slice(0, 2) + '/' + value.slice(2, 4);
                }
                e.target.value = value;
            });
        }

        const cvvInput = document.getElementById('cvv');
        if (cvvInput) {
            cvvInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
            });
        }
    }

    setupPaymentMethodToggle() {
        const paymentMethods = document.querySelectorAll('input[name="paymentMethod"]');
        paymentMethods.forEach(method => {
            method.addEventListener('change', () => {
                const cardDetails = document.getElementById('cardDetails');
                if (method.value === 'credit-card' || method.value === 'debit-card') {
                    cardDetails.style.display = 'block';
                    document.getElementById('cardName').required = true;
                    document.getElementById('cardNumber').required = true;
                    document.getElementById('expiryDate').required = true;
                    document.getElementById('cvv').required = true;
                } else {
                    cardDetails.style.display = 'none';
                    document.getElementById('cardName').required = false;
                    document.getElementById('cardNumber').required = false;
                    document.getElementById('expiryDate').required = false;
                    document.getElementById('cvv').required = false;
                }
            });
        });
    }

    setupBillingAddressToggle() {
        const sameAsBillingCheckbox = document.getElementById('sameAsBilling');
        const billingForm = document.getElementById('billingForm');

        sameAsBillingCheckbox.addEventListener('change', () => {
            if (sameAsBillingCheckbox.checked) {
                billingForm.style.display = 'none';
                document.querySelectorAll('input[id^="billing"]').forEach(input => {
                    input.required = false;
                });
            } else {
                billingForm.style.display = 'block';
                document.querySelectorAll('input[id^="billing"]').forEach(input => {
                    input.required = true;
                });
            }
        });

        // Trigger initial state
        sameAsBillingCheckbox.dispatchEvent(new Event('change'));
    }

    getCartItems() {
        const savedCart = localStorage.getItem('restaurantCart');
        if (savedCart) {
            try {
                const cartData = JSON.parse(savedCart);
                if (cartData.items?.length) return cartData.items;
            } catch (e) { /* fall through */ }
        }
        return [
            { id: '1', name: 'Pasta Carbonara', price: 14.99, quantity: 1 },
            { id: '2', name: 'Grilled Salmon', price: 24.99, quantity: 1 },
            { id: '3', name: 'Chocolate Cake', price: 8.99, quantity: 2 }
        ];
    }

    getOrderTotals(items) {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shipping = subtotal >= 50 ? 0 : 5;
        const promo = localStorage.getItem('appliedPromo');
        const discount = this.calculateDiscount(promo, subtotal);
        const tax = (subtotal - discount) * 0.1;
        const total = subtotal - discount + shipping + tax;
        return { subtotal, shipping, tax, discount, total };
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validator.validateSection(3)) {
            this.showNotification('Please fix the errors in payment information', 'error');
            return;
        }

        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData);
        const items = this.getCartItems();
        const totals = this.getOrderTotals(items);
        const customerName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
        const fullAddress = [data.address, data.city, data.state, data.zipCode, data.country]
            .filter(Boolean).join(', ');

        const submitBtn = this.form.querySelector('.btn-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Placing Order...';
        }

        try {
            const result = await api.createOrder({
                customerName,
                email: data.email || '',
                phone: data.phone,
                address: fullAddress,
                city: data.city || '',
                state: data.state || '',
                zipCode: data.zipCode || '',
                country: data.country || '',
                paymentMethod: data.paymentMethod || 'credit-card',
                items: items.map((item) => ({
                    name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                ...totals
            });

            this.orderNumber = result.data.orderId;
            this.showSuccessModal();
        } catch (error) {
            this.showNotification(error.message || 'Failed to place order. Is the server running?', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-lock"></i> Complete Order';
            }
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('successModal');
        document.getElementById('orderNumber').textContent = `Order ${this.orderNumber}`;
        modal.classList.add('show');
    }

    loadCartSummary() {
        // Try to load cart from localStorage (from shopping cart)
        const savedCart = localStorage.getItem('restaurantCart');
        const orderItemsContainer = document.getElementById('orderItems');

        if (savedCart) {
            try {
                const cartData = JSON.parse(savedCart);
                const items = cartData.items || [];

                if (items.length > 0) {
                    let html = '';
                    let subtotal = 0;

                    items.forEach(item => {
                        const itemTotal = item.price * item.quantity;
                        subtotal += itemTotal;
                        html += `
                            <div class="order-item">
                                <span class="order-item-name">${item.name}</span>
                                <span class="order-item-qty">x${item.quantity}</span>
                                <span class="order-item-price">$${itemTotal.toFixed(2)}</span>
                            </div>
                        `;
                    });

                    orderItemsContainer.innerHTML = html;

                    // Update totals
                    const shipping = subtotal >= 50 ? 0 : 5;
                    const tax = subtotal * 0.1;
                    const discount = this.calculateDiscount(cartData.appliedDiscount, subtotal);
                    const total = subtotal + shipping + tax - discount;

                    document.getElementById('summarySubtotal').textContent = `$${subtotal.toFixed(2)}`;
                    document.getElementById('summaryShipping').textContent = `$${shipping.toFixed(2)}`;
                    document.getElementById('summaryTax').textContent = `$${tax.toFixed(2)}`;
                    document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;

                    if (discount > 0) {
                        document.getElementById('summaryDiscount').textContent = `-$${discount.toFixed(2)}`;
                        document.getElementById('discountRow').style.display = 'flex';
                    }
                } else {
                    this.loadSampleCart();
                }
            } catch (e) {
                this.loadSampleCart();
            }
        } else {
            this.loadSampleCart();
        }
    }

    loadSampleCart() {
        const sampleItems = [
            { name: 'Pasta Carbonara', price: 14.99, quantity: 1 },
            { name: 'Grilled Salmon', price: 24.99, quantity: 1 },
            { name: 'Chocolate Cake', price: 8.99, quantity: 2 }
        ];

        let html = '';
        let subtotal = 0;

        sampleItems.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            html += `
                <div class="order-item">
                    <span class="order-item-name">${item.name}</span>
                    <span class="order-item-qty">x${item.quantity}</span>
                    <span class="order-item-price">$${itemTotal.toFixed(2)}</span>
                </div>
            `;
        });

        document.getElementById('orderItems').innerHTML = html;

        const shipping = subtotal >= 50 ? 0 : 5;
        const tax = subtotal * 0.1;
        const total = subtotal + shipping + tax;

        document.getElementById('summarySubtotal').textContent = `$${subtotal.toFixed(2)}`;
        document.getElementById('summaryShipping').textContent = `$${shipping.toFixed(2)}`;
        document.getElementById('summaryTax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('summaryTotal').textContent = `$${total.toFixed(2)}`;
    }

    calculateDiscount(couponCode, subtotal) {
        const discounts = {
            'WELCOME10': { type: 'percentage', value: 10 },
            'SAVE20': { type: 'percentage', value: 20 },
            'FLAT5': { type: 'fixed', value: 5 }
        };

        if (!couponCode || !discounts[couponCode]) return 0;

        const discount = discounts[couponCode];
        if (discount.type === 'percentage') {
            return subtotal * (discount.value / 100);
        } else if (discount.type === 'fixed') {
            return discount.value;
        }
        return 0;
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification show ${type}`;
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// ==========================================
// GLOBAL FUNCTIONS
// ==========================================

let formManager;

function goToNextSection(currentSection) {
    formManager.goToSection(currentSection + 1);
}

function goToPreviousSection(currentSection) {
    formManager.goToSection(currentSection - 1);
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.remove('show');
}

function goToHome() {
    // Clear cart after successful order
    localStorage.removeItem('restaurantCart');
    window.location.href = 'index.html';
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    formManager = new CheckoutFormManager('checkoutForm');

    // Apply promo code
    document.getElementById('applyPromoBtn').addEventListener('click', () => {
        const code = document.getElementById('promoCode').value.toUpperCase();
        if (!code) {
            formManager.showNotification('Please enter a promo code', 'warning');
            return;
        }

        const validCodes = ['WELCOME10', 'SAVE20', 'FLAT5', 'FREESHIP'];
        if (validCodes.includes(code)) {
            formManager.showNotification(`Promo code "${code}" applied!`, 'success');
            // Update cart with promo
            localStorage.setItem('appliedPromo', code);
        } else {
            formManager.showNotification('Invalid promo code', 'error');
        }
    });

    // Real-time validation
    document.querySelectorAll('input, select').forEach(field => {
        field.addEventListener('blur', () => {
            if (field.name in validationRules) {
                const section = field.closest('fieldset');
                formManager.validator.clearErrors(section);
                formManager.validator.validate(field.name, field.value);
                if (formManager.validator.errors[field.name]) {
                    field.classList.add('error');
                    const errorMsg = field.parentElement.querySelector('.error-message');
                    if (errorMsg) {
                        errorMsg.textContent = formManager.validator.errors[field.name];
                    }
                } else {
                    field.classList.add('success');
                }
            }
        });

        field.addEventListener('input', () => {
            if (field.classList.contains('error')) {
                field.classList.remove('error');
            }
        });
    });

    console.log('Checkout form initialized');
});
