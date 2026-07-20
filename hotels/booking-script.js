// ==========================================
// VALIDATION RULES
// ==========================================

const validationRules = {
    firstName: {
        required: true,
        pattern: /^[a-zA-Z\s'-]{2,}$/,
        message: 'Please enter a valid first name'
    },
    lastName: {
        required: true,
        pattern: /^[a-zA-Z\s'-]{2,}$/,
        message: 'Please enter a valid last name'
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
    bookingDate: {
        required: true,
        message: 'Please select a date'
    },
    bookingTime: {
        required: true,
        message: 'Please select a time'
    },
    guestCount: {
        required: true,
        message: 'Please select number of guests'
    },
    specialRequests: {
        maxLength: 200,
        message: 'Special requests must be less than 200 characters'
    },
    agreeTerms: {
        required: true,
        message: 'Please agree to the cancellation policy'
    }
};

// ==========================================
// TIME SLOTS CONFIGURATION
// =========================================

const RESTAURANT_HOURS = {
    'Monday': { open: 11, close: 22 },
    'Tuesday': { open: 11, close: 22 },
    'Wednesday': { open: 11, close: 22 },
    'Thursday': { open: 11, close: 22 },
    'Friday': { open: 11, close: 23 },
    'Saturday': { open: 11, close: 23 },
    'Sunday': { open: 12, close: 21 }
};

const BOOKED_SLOTS = {}; // Will be populated with booked times

// ==========================================
// BOOKING MANAGER CLASS
// ==========================================

class BookingManager {
    constructor(formId) {
        this.form = document.getElementById(formId);
        this.currentStep = 1;
        this.bookingData = {
            date: null,
            time: null,
            guests: 2,
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            occasion: '',
            specialRequests: '',
            dietary: [],
            agreeTerms: false
        };
        this.confirmationNumber = this.generateConfirmationNumber();
        this.init();
    }

    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.initializeDatePicker();
        this.setupFormValidation();
    }

    // ==========================================
    // DATE PICKER
    // ==========================================

    initializeDatePicker() {
        const dateInput = document.getElementById('bookingDate');
        const dateField = document.getElementById('bookingDateField');
        const trigger = document.getElementById('datePickerTrigger');
        const today = new Date();

        dateInput.min = this.formatDate(today);

        const maxDate = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
        dateInput.max = this.formatDate(maxDate);

        const openPicker = () => {
            dateInput.focus({ preventScroll: true });
            if (typeof dateInput.showPicker === 'function') {
                try {
                    dateInput.showPicker();
                } catch (_) {
                    /* picker already open or blocked */
                }
            }
        };

        dateInput.addEventListener('click', (e) => {
            e.stopPropagation();
            openPicker();
        });

        trigger?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPicker();
        });

        dateField?.addEventListener('click', (e) => {
            if (e.target === dateInput) return;
            openPicker();
        });

        dateInput.addEventListener('change', (e) => {
            this.bookingData.date = e.target.value;
            this.syncFieldFilledState(dateInput);
            this.updateTimeSlots();
            this.updateSummary();
        });

        dateInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openPicker();
            }
        });
    }

    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // ==========================================
    // TIME SLOTS
    // ==========================================

    updateTimeSlots() {
        const timeGrid = document.getElementById('timeGrid');
        timeGrid.innerHTML = '';

        if (!this.bookingData.date) {
            return;
        }

        const date = new Date(this.bookingData.date);
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
        const hours = RESTAURANT_HOURS[dayName];

        // Generate time slots
        for (let hour = hours.open; hour < hours.close; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const isBooked = this.isTimeSlotBooked(this.bookingData.date, time);
                
                const slot = document.createElement('button');
                slot.type = 'button';
                slot.className = `time-slot${isBooked ? ' unavailable disabled' : ''}`;
                slot.textContent = time;
                
                if (!isBooked) {
                    slot.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.selectTimeSlot(slot, time);
                    });
                }
                
                timeGrid.appendChild(slot);
            }
        }
    }

    selectTimeSlot(element, time) {
        document.querySelectorAll('.time-slot').forEach((slot) => {
            slot.classList.remove('selected', 'active');
        });

        element.classList.add('selected');
        this.bookingData.time = time;
        document.getElementById('bookingTime').value = time;
        this.updateSummary();
    }

    isTimeSlotBooked(date, time) {
        // In a real app, this would check against a server database
        return false;
    }

    // ==========================================
    // GUESTS
    // ==========================================

    adjustGuests(delta) {
        const guestCount = document.getElementById('guestCount');
        let newCount = parseInt(guestCount.value) + delta;
        
        if (newCount < 1) newCount = 1;
        if (newCount > 12) newCount = 12;
        
        guestCount.value = newCount;
        this.bookingData.guests = newCount;
        this.updateSummary();
    }

    // ==========================================
    // FORM NAVIGATION
    // ==========================================

    goToStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 3) return;

        // Validate current step before moving forward
        if (stepNumber > this.currentStep) {
            if (!this.validateStep(this.currentStep)) {
                this.showNotification('Please fill in all required fields', 'error');
                return;
            }
        }

        // Hide current step
        document.querySelector(`.booking-step[data-step="${this.currentStep}"]`)
            .classList.remove('active');

        // Show new step
        document.querySelector(`.booking-step[data-step="${stepNumber}"]`)
            .classList.add('active');

        // Update sidebar indicator
        this.updateStepIndicator(stepNumber);

        this.currentStep = stepNumber;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateStepIndicator(currentStep) {
        document.querySelectorAll('.stepper-item, .step-dot').forEach((el) => {
            const step = parseInt(el.dataset.step);
            el.classList.remove('active', 'done');
            if (step < currentStep) el.classList.add('done');
            if (step === currentStep) el.classList.add('active');
        });
    }

    // ==========================================
    // VALIDATION
    // ==========================================

    validateStep(stepNumber) {
        const section = document.querySelector(`.booking-step[data-step="${stepNumber}"]`);
        const fields = section.querySelectorAll('input, select, textarea');
        let isValid = true;

        fields.forEach(field => {
            if (this.validateField(field)) {
                field.classList.remove('error');
            } else {
                field.classList.add('error');
                isValid = false;
            }
        });

        return isValid;
    }

    validateField(field) {
        const rule = validationRules[field.name];
        if (!rule) return true;

        const value = field.type === 'checkbox' ? field.checked : field.value.trim();

        // Check required
        if (rule.required && !value) {
            this.showFieldError(field, rule.message);
            return false;
        }

        // Check pattern
        if (rule.pattern && value && !rule.pattern.test(value)) {
            this.showFieldError(field, rule.message);
            return false;
        }

        // Check maxLength
        if (rule.maxLength && value.length > rule.maxLength) {
            this.showFieldError(field, rule.message);
            return false;
        }

        this.clearFieldError(field);
        return true;
    }

    showFieldError(field, message) {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    clearFieldError(field) {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = '';
        }
        field.classList.remove('error');
    }

    setupFormValidation() {
        document.querySelectorAll('input, select, textarea').forEach(field => {
            field.addEventListener('blur', () => {
                this.validateField(field);
            });

            field.addEventListener('input', () => {
                if (field.classList.contains('error')) {
                    field.classList.remove('error');
                }
                this.updateBookingData(field);
                this.updateSummary();
            });

            field.addEventListener('change', () => {
                this.updateBookingData(field);
                this.syncFieldFilledState(field);
            });

            this.syncFieldFilledState(field);
        });
    }

    syncFieldFilledState(field) {
        const wrap = field.closest('.form-field');
        if (!wrap) return;
        const hasValue = field.type === 'checkbox'
            ? field.checked
            : String(field.value || '').trim().length > 0;
        wrap.classList.toggle('is-filled', hasValue);
    }

    updateBookingData(field) {
        if (field.type === 'checkbox' && field.name === 'dietary') {
            const dietary = Array.from(document.querySelectorAll('input[name="dietary"]:checked'))
                .map(cb => cb.value);
            this.bookingData.dietary = dietary;
        } else if (field.type === 'checkbox') {
            this.bookingData[field.name] = field.checked;
        } else {
            this.bookingData[field.name] = field.value;
        }
    }

    // ==========================================
    // SUMMARY UPDATE
    // ==========================================

    updateSummary() {
        const dateInput = document.getElementById('bookingDate');
        if (dateInput.value) {
            const date = new Date(dateInput.value);
            const formattedDate = date.toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            document.getElementById('summaryDate').textContent = formattedDate;
        }

        document.getElementById('summaryTime').textContent = this.bookingData.time || '-';
        document.getElementById('summaryGuests').textContent = this.bookingData.guests;

        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const fullName = `${firstName} ${lastName}`.trim() || '-';
        document.getElementById('summaryName').textContent = fullName;

        const phone = document.getElementById('phone').value || '-';
        document.getElementById('summaryPhone').textContent = phone;
    }

    // ==========================================
    // FORM SUBMISSION
    // ==========================================

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateStep(3)) {
            this.showNotification('Please complete all required fields', 'error');
            return;
        }

        this.collectFormData();

        const dietary = [...document.querySelectorAll('input[name="dietary"]:checked')]
            .map((cb) => cb.value);

        const payload = {
            customerName: `${document.getElementById('firstName').value} ${document.getElementById('lastName').value}`.trim(),
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            bookingDate: document.getElementById('bookingDate').value,
            bookingTime: document.getElementById('bookingTime').value,
            guestCount: parseInt(document.getElementById('guestCount').value, 10),
            occasion: document.getElementById('occasion').value,
            specialRequests: document.getElementById('specialRequests').value,
            dietary
        };

        const submitBtn = this.form.querySelector('.btn-submit');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
        }

        try {
            const result = await api.createReservation(payload);
            this.confirmationNumber = result.data.reservationId;
            this.bookingData = { ...this.bookingData, ...payload, date: payload.bookingDate, time: payload.bookingTime, guests: payload.guestCount };
            this.showSuccessModal();
        } catch (error) {
            this.showNotification(error.message || 'Booking failed. Start the server with: cd server && npm start', 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check"></i> Confirm Booking';
            }
        }
    }

    collectFormData() {
        const formElements = this.form.elements;
        for (let element of formElements) {
            if (element.name && element.name in this.bookingData) {
                if (element.type === 'checkbox' && element.name !== 'dietary') {
                    this.bookingData[element.name] = element.checked;
                } else if (element.type !== 'checkbox') {
                    this.bookingData[element.name] = element.value;
                }
            }
        }
    }

    showSuccessModal() {
        // Log booking data (in real app, would send to server)
        console.log('Booking submitted:', this.bookingData);
        console.log('Confirmation number:', this.confirmationNumber);

        // Update modal with confirmation details
        const date = new Date(this.bookingData.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        document.getElementById('confirmationNumber').textContent = this.confirmationNumber;
        document.getElementById('confirmDate').textContent = formattedDate;
        document.getElementById('confirmTime').textContent = this.bookingData.time;
        document.getElementById('confirmGuests').textContent = this.bookingData.guests;
        document.getElementById('confirmEmail').textContent = this.bookingData.email;

        // Save booking to localStorage
        this.saveBooking();

        // Show modal
        document.getElementById('successModal').classList.add('show');
    }

    saveBooking() {
        const bookings = JSON.parse(localStorage.getItem('restaurantBookings')) || [];
        bookings.push({
            ...this.bookingData,
            confirmationNumber: this.confirmationNumber,
            bookedAt: new Date().toISOString()
        });
        localStorage.setItem('restaurantBookings', JSON.stringify(bookings));
    }

    generateConfirmationNumber() {
        return 'RES' + Math.floor(100000 + Math.random() * 900000);
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

let bookingManager;

function goToStep(stepNumber) {
    bookingManager.goToStep(stepNumber);
}

function increaseGuests() {
    bookingManager.adjustGuests(1);
}

function decreaseGuests() {
    bookingManager.adjustGuests(-1);
}

function closeModal() {
    document.getElementById('successModal').classList.remove('show');
}

function goToHome() {
    window.location.href = 'index.html';
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    bookingManager = new BookingManager('bookingForm');

    // Initialize time slots display
    const dateInput = document.getElementById('bookingDate');
    if (dateInput) {
        // Trigger initial setup
        setTimeout(() => {
            bookingManager.updateTimeSlots();
        }, 100);
    }

    console.log('Booking system initialized');
});

// ==========================================
// DEBUG: Load sample bookings
// ==========================================

function viewBookings() {
    const bookings = JSON.parse(localStorage.getItem('restaurantBookings')) || [];
    console.log('All bookings:', bookings);
    return bookings;
}

function clearBookings() {
    localStorage.removeItem('restaurantBookings');
    console.log('Bookings cleared');
}
