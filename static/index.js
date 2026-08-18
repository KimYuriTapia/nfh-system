document.addEventListener('DOMContentLoaded', () => {
    const signInBox = document.getElementById('signin-box');
    const signUpBox = document.getElementById('signup-box');
    const forgotPasswordBox = document.getElementById('forgot-password-box');

    const toSignUpBtn = document.getElementById('to-signup');
    const toForgotPasswordBtn = document.getElementById('to-forgot-password');
    const toSignInLinks = document.querySelectorAll('.to-signin-link, #to-signin');

    const signInForm = document.getElementById('signin-form');
    const signUpForm = document.getElementById('signup-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');

    let isEmailVerified = false;

    // View Toggles
    function showBox(boxToShow) {
        if (signInBox) signInBox.style.display = 'none';
        if (signUpBox) signUpBox.style.display = 'none';
        if (forgotPasswordBox) forgotPasswordBox.style.display = 'none';
        if (boxToShow) boxToShow.style.display = 'block';
    }

    if (toSignUpBtn) {
        toSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(signUpBox);
        });
    }

    if (toForgotPasswordBtn) {
        toForgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(forgotPasswordBox);
        });
    }

    toSignInLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(signInBox);
        });
    });

    // Registration - Send Code
    const btnSendRegCode = document.getElementById('btn-send-reg-code');
    if (btnSendRegCode) {
        btnSendRegCode.addEventListener('click', async () => {
            const email = document.getElementById('reg-email').value.trim();
            if (!email) {
                alert('Please enter an email address first.');
                return;
            }

            btnSendRegCode.disabled = true;
            btnSendRegCode.textContent = 'Sending...';

            try {
                const response = await fetch('/api/send-registration-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();
                if (response.ok && result.status === 'success') {
                    alert('Verification code sent! Please check your email inbox.');
                    document.getElementById('reg-code-wrapper').style.display = 'block';
                } else {
                    alert(result.message || 'Failed to send verification code.');
                }
            } catch (err) {
                console.error('Error sending code:', err);
                alert('Connection error. Please try again.');
            } finally {
                btnSendRegCode.disabled = false;
                btnSendRegCode.textContent = 'Resend Code';
            }
        });
    }

    // Registration - Verify Code
    const btnVerifyRegCode = document.getElementById('btn-verify-reg-code');
    if (btnVerifyRegCode) {
        btnVerifyRegCode.addEventListener('click', async () => {
            const email = document.getElementById('reg-email').value.trim();
            const code = document.getElementById('reg-code').value.trim();

            if (!code || code.length !== 6) {
                alert('Please enter a valid 6-digit code.');
                return;
            }

            btnVerifyRegCode.disabled = true;

            try {
                const response = await fetch('/api/verify-registration-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code })
                });

                const result = await response.json();
                const statusSpan = document.getElementById('reg-code-status');

                if (response.ok && result.status === 'success') {
                    isEmailVerified = true;
                    if (statusSpan) {
                        statusSpan.textContent = 'Email Verified ✓';
                        statusSpan.style.color = '#2D6A4F';
                    }
                    document.getElementById('btn-signup-submit').disabled = false;
                    document.getElementById('reg-email').readOnly = true;
                    btnSendRegCode.style.display = 'none';
                    btnVerifyRegCode.style.display = 'none';
                } else {
                    alert(result.message || 'Verification failed.');
                    if (statusSpan) {
                        statusSpan.textContent = 'Invalid or expired code.';
                        statusSpan.style.color = '#d9534f';
                    }
                }
            } catch (err) {
                console.error('Error verifying code:', err);
                alert('Connection error. Please try again.');
            } finally {
                btnVerifyRegCode.disabled = false;
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
                    if (result.redirect) {
                        window.location.href = result.redirect;
                    } else {
                        window.location.href = '/home';
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

            if (!isEmailVerified) {
                alert('Please verify your email address before completing registration.');
                return;
            }

            const phone = document.getElementById('reg-phone').value.trim();
            const phoneRegex = /^09\d{9}$/;
            if (!phoneRegex.test(phone)) {
                alert('Phone number must contain exactly 11 digits starting with 09 (e.g. 09123456789).');
                return;
            }

            const submitBtn = document.getElementById('btn-signup-submit');
            const firstName = document.getElementById('reg-first').value.trim();
            const lastName = document.getElementById('reg-last').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const username = document.getElementById('reg-user').value.trim();
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
                    showBox(signInBox);
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

    // Handle Forgot Password - Send Code
    const btnSendResetCode = document.getElementById('btn-send-reset-code');
    if (btnSendResetCode) {
        btnSendResetCode.addEventListener('click', async () => {
            const email = document.getElementById('reset-email').value.trim();
            if (!email) {
                alert('Please enter your email address.');
                return;
            }

            btnSendResetCode.disabled = true;
            btnSendResetCode.textContent = 'Sending...';

            try {
                const response = await fetch('/api/forgot-password/send-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const result = await response.json();
                if (response.ok && result.status === 'success') {
                    alert('Password reset code sent to your email.');
                    document.getElementById('reset-code-group').style.display = 'block';
                    document.getElementById('reset-pass-group').style.display = 'block';
                    document.getElementById('btn-reset-password-submit').style.display = 'block';
                    document.getElementById('reset-email').readOnly = true;
                    btnSendResetCode.style.display = 'none';
                } else {
                    alert(result.message || 'Email not found.');
                }
            } catch (err) {
                console.error('Error sending reset code:', err);
                alert('Connection error. Please try again.');
            } finally {
                btnSendResetCode.disabled = false;
                btnSendResetCode.textContent = 'Send Code';
            }
        });
    }

    // Handle Forgot Password - Submit Reset
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('reset-email').value.trim();
            const code = document.getElementById('reset-code').value.trim();
            const newPassword = document.getElementById('reset-new-pass').value;
            const submitBtn = document.getElementById('btn-reset-password-submit');

            if (!code || code.length !== 6) {
                alert('Please enter the 6-digit reset code.');
                return;
            }

            if (!newPassword || newPassword.length < 8) {
                alert('Password must be at least 8 characters.');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Resetting...';
            }

            try {
                const response = await fetch('/api/forgot-password/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, code, new_password: newPassword })
                });

                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    alert(result.message);
                    forgotPasswordForm.reset();
                    showBox(signInBox);
                } else {
                    alert(result.message || 'Reset failed.');
                }
            } catch (err) {
                console.error('Password reset error:', err);
                alert('Connection error. Please try again.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Reset Password';
                }
            }
        });
    }
});