
function setupPasswordToggle(toggleId, inputId) {
    const toggleElement = document.getElementById(toggleId);
    const inputElement = document.getElementById(inputId);

    if (toggleElement && inputElement) {
        toggleElement.onclick = function () {
            const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
            inputElement.setAttribute('type', type);

            // İkonu değiştir
            this.classList.toggle('fa-eye');
            this.classList.toggle('fa-eye-slash');

            // Renk geri bildirimi
            this.style.color = type === 'text' ? '#28a745' : 'rgba(255,255,255,0.4)';
        };
    }
}

/**
 *reg işlemi
 */
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    setupPasswordToggle('toggleRegisterPassword', 'reg_password');

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameValue = document.getElementById('full_name').value;
        const emailValue = document.getElementById('email').value;
        const passwordValue = document.getElementById('reg_password').value;
        const roleValue = document.getElementById('role')?.value || "driver";
        const messageDiv = document.getElementById('message');

        try {
            const response = await fetch('/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameValue,
                    email: emailValue,
                    password: passwordValue,
                    role: roleValue
                })
            });

            const result = await response.json();

            if (response.ok) {
                messageDiv.style.color = "#28a745";
                messageDiv.innerText = "Account created successfully! You are being redirected to login...";
                setTimeout(() => window.location.href = "/login", 2000);
            } else {
                messageDiv.style.color = "#ff6b6b";
                messageDiv.innerText = result.detail || "Registration failed.";
            }
        } catch (error) {
            messageDiv.style.color = "#ff6b6b";
            messageDiv.innerText = "Server connection error.";
        }
    });
}

/**
 *login işlemi
 */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    setupPasswordToggle('toggleLoginPassword', 'password');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailValue = document.getElementById('email').value;
        const passwordValue = document.getElementById('password').value;
        const messageDiv = document.getElementById('message');

        const formData = new FormData();
        formData.append('username', emailValue);
        formData.append('password', passwordValue);

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                localStorage.setItem('token', result.access_token);
                messageDiv.style.color = "#28a745";
                messageDiv.innerText = "Signing in... Please wait...";
                setTimeout(() => window.location.href = "/", 1000);
            } else {
                messageDiv.style.color = "#ff6b6b";
                messageDiv.innerText = result.detail || "Email or password is incorrect.";
            }
        } catch (error) {
            messageDiv.style.color = "#ff6b6b";
            messageDiv.innerText = "Server connection error.";
        }
    });
}