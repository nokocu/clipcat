document.addEventListener('mousemove', function(event) {
    const cat = document.querySelector('.cat');
    const eyes = document.querySelectorAll('.eye-pupil');

    eyes.forEach(eye => {
        const { left, top, width, height } = eye.getBoundingClientRect();
        const eyeCenterX = left + width / 2;
        const eyeCenterY = top + height / 2;
        const deltaX = event.clientX - eyeCenterX;
        const deltaY = event.clientY - eyeCenterY;
        const angle = Math.atan2(deltaY, deltaX);
        const distance = Math.min(10, Math.hypot(deltaX, deltaY));
        const eyeX = distance * Math.cos(angle);
        const eyeY = distance * Math.sin(angle);

        eye.style.transform = `translate(${eyeX}px, ${eyeY}px)`;
    });
});