const navLinks = document.querySelectorAll(".nav-menu .nav-link");
const menuOpenButton = document.querySelector("#menu-open-button");
const menuCloseButton = document.querySelector("#menu-close-button");

menuOpenButton.addEventListener("click", () => {
// Toggle mobile menu visibility
    document.body.classList.toggle("show-mobile-menu")
});

//Close menu when the close button is clicked
menuCloseButton.addEventListener("click", () => menuOpenButton.click());

//Close menu when the nav link is clicked
navLinks.forEach(link => {
    link.addEventListener("click", () => menuOpenButton.click());
})

//Initialize swiper
// Initialize swiper – FULLY SWIPABLE + 1 CARD ON MOBILE
const swiper = new Swiper('.slider-wrapper', {
    loop: true,
    grabCursor: true,
    spaceBetween: 30,
    centeredSlides: true,
    slidesPerView: 'auto',           // REQUIRED FOR SWIPE + CENTER
    watchSlidesProgress: true,

    // Enable touch
    touchRatio: 1,
    touchAngle: 45,
    simulateTouch: true,
    allowTouchMove: true,

    // Pagination
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
        dynamicBullets: true,
    },

    // Navigation – YOUR CLASSES
    navigation: {
        nextEl: '.swiper-slide-button:last-of-type',
        prevEl: '.swiper-slide-button:first-of-type'
    },

    // Breakpoints
    breakpoints: {
        0: {
            slidesPerView: 1,
            spaceBetween: 20
        },
        768: {
            slidesPerView: 2,
            spaceBetween: 25
        },
        1024: {
            slidesPerView: 3,
            spaceBetween: 30
        }
    }
});



  
