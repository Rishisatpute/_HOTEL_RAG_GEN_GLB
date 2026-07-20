/**
 * Savory Haus — Shared UI (nav, scroll, reveal, page chrome)
 */
(function () {
  'use strict';

  const PAGE_META = {
    'index.html': { title: 'Home', parent: null },
    'menu.html': { title: 'Menu', parent: 'index.html' },
    'restaurant-menu.html': { title: 'Menu', parent: 'index.html' },
    'about.html': { title: 'About', parent: 'index.html' },
    'contact.html': { title: 'Contact', parent: 'index.html' },
    'booking.html': { title: 'Reservations', parent: 'index.html' },
    'checkout.html': { title: 'Checkout', parent: 'shopping-cart.html' },
    'shopping-cart.html': { title: 'Your Order', parent: 'restaurant-menu.html' },
    'admin-dashboard.html': { title: 'Dashboard', parent: 'index.html' },
    'kitchen-dashboard.html': { title: 'Kitchen', parent: 'admin-dashboard.html' }
  };

  /* Page loader */
  function initLoader() {
    const loader = document.createElement('div');
    loader.className = 'page-loader';
    loader.innerHTML = '<span class="loader-logo">SAVORY HAUS</span><div class="loader-bar"></div>';
    document.body.prepend(loader);
    document.body.classList.add('page-loading');

    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('hidden');
        document.body.classList.remove('page-loading');
        document.body.classList.add('page-ready');
        setTimeout(() => loader.remove(), 600);
      }, 400);
    });
  }

  /* Sticky navbar */
  function initNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    const onScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Mobile menu */
  function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
      document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    });

    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  /* Active nav link */
  function setActiveNav() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach((link) => {
      const href = link.getAttribute('href');
      link.classList.toggle('active', href === page || (page === '' && href === 'index.html'));
    });
  }

  /* Breadcrumbs + back button for internal pages */
  function injectPageChrome() {
    const chrome = document.querySelector('[data-page-chrome]');
    if (!chrome) return;

    const page = window.location.pathname.split('/').pop() || 'index.html';
    const meta = PAGE_META[page] || { title: document.title, parent: 'index.html' };
    const parentMeta = meta.parent ? PAGE_META[meta.parent] : null;

    let crumbs = `<a href="index.html">Home</a>`;
    if (parentMeta && meta.parent !== 'index.html') {
      crumbs += `<span class="sep">/</span><a href="${meta.parent}">${parentMeta.title}</a>`;
    }
    crumbs += `<span class="sep">/</span><span class="current">${meta.title}</span>`;

    const backHref = meta.parent || 'index.html';

    chrome.innerHTML = `
      <div class="container">
        <a href="${backHref}" class="btn-back"><i class="fas fa-arrow-left"></i> Back</a>
        <nav class="breadcrumbs" aria-label="Breadcrumb">${crumbs}</nav>
      </div>`;
  }

  /* Scroll reveal */
  function initReveal() {
    const els = document.querySelectorAll('.reveal');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    els.forEach((el) => observer.observe(el));
  }

  /* Smooth anchor scroll */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const id = this.getAttribute('href');
        if (id === '#') return;
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setActiveNav();
    initNavbar();
    initMobileMenu();
    injectPageChrome();
    initReveal();
    initSmoothScroll();
  });

  if (document.readyState === 'loading') {
    initLoader();
  } else {
    document.body.classList.add('page-ready');
  }
})();
