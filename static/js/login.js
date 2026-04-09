document.addEventListener("DOMContentLoaded", function () {
    const alerts = document.querySelectorAll('.auto-close');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 3000);
    });
});