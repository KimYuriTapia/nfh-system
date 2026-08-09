document.addEventListener('DOMContentLoaded', () => {
    const signInBox = document.getElementById('signin-box');
    const signUpBox = document.getElementById('signup-box');
    const toSignUpBtn = document.getElementById('to-signup');
    const toSignInBtn = document.getElementById('to-signin');
    const signInForm = document.getElementById('signin-form');
    const signUpForm = document.getElementById('signup-form');

    // Toggle to Sign Up
    if (toSignUpBtn) {
        toSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (signInBox && signUpBox) {
                signInBox.style.display = 'none';
                signUpBox.style.display = 'block';
            }
        });
    }

    // Toggle to Sign In
    if (toSignInBtn) {
        toSignInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (signInBox && signUpBox) {
                signUpBox.style.display = 'none';
                signInBox.style.display = 'block';
            }
        });
    }

    // Handle Sign In Submit
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('btn-signin-submit');
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Signing in...';
            }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    // FIX: Use backend role-based redirect URL instead of hardcoded '/portal'
                    if (result.redirect) {
                        window.location.href = result.redirect;
                    } else {
                        window.location.href = '/portal';
                    }
                } else {
                    alert(result.message || 'Invalid username or password.');
                }
            } catch (err) {
                console.error('Sign-in error:', err);
                alert('Connection error. Please try again.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign In';
                }
            }
        });
    }

    // Handle Sign Up Submit
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('btn-signup-submit');
            const firstName = document.getElementById('reg-first').value.trim();
            const lastName = document.getElementById('reg-last').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const username = document.getElementById('reg-user').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const password = document.getElementById('reg-pass').value;
            const passwordConfirm = document.getElementById('reg-pass-confirm').value;

            if (password !== passwordConfirm) {
                alert('Passwords do not match. Please re-enter.');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating Account...';
            }

            try {
                const response = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        username: username,
                        phone: phone,
                        password: password,
                        password_confirm: passwordConfirm
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    alert(result.message);
                    signUpForm.reset();
                    if (signInBox && signUpBox) {
                        signUpBox.style.display = 'none';
                        signInBox.style.display = 'block';
                    }
                } else {
                    alert(result.message || 'Registration failed.');
                }
            } catch (err) {
                console.error('Sign-up error:', err);
                alert('Connection error. Please check your terminal or server.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign Up';
                }
            }
        });
    }
});