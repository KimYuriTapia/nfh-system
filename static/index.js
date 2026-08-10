document.addEventListener('DOMContentLoaded', () => {
    const signInBox = document.getElementById('signin-box');
    const signUpBox = document.getElementById('signup-box');
    const verifyBox = document.getElementById('verify-box');
    const forgotBox = document.getElementById('forgot-box');
    const resetBox = document.getElementById('reset-box');

    const toSignUpBtn = document.getElementById('to-signup');
    const toSignInBtn = document.getElementById('to-signin');
    const toForgotBtn = document.getElementById('to-forgot');
    const backToSignInBtns = document.querySelectorAll('.back-to-signin');

    const signInForm = document.getElementById('signin-form');
    const signUpForm = document.getElementById('signup-form');
    const verifyForm = document.getElementById('verify-form');
    const forgotForm = document.getElementById('forgot-form');
    const resetForm = document.getElementById('reset-form');

    let currentVerifyingEmail = '';

    function showBox(boxToShow) {
        [signInBox, signUpBox, verifyBox, forgotBox, resetBox].forEach(b => {
            if (b) b.style.display = 'none';
        });
        if (boxToShow) boxToShow.style.display = 'block';
    }

    if (toSignUpBtn) toSignUpBtn.addEventListener('click', (e) => { e.preventDefault(); showBox(signUpBox); });
    if (toSignInBtn) toSignInBtn.addEventListener('click', (e) => { e.preventDefault(); showBox(signInBox); });
    if (toForgotBtn) toForgotBtn.addEventListener('click', (e) => { e.preventDefault(); showBox(forgotBox); });
    backToSignInBtns.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); showBox(signInBox); }));

    // Handle Sign In Submit
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-signin-submit');
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in...'; }

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const result = await response.json();

                if (result.status === 'success') {
                    window.location.href = result.redirect || '/home';
                } else {
                    alert(result.message || 'Invalid username or password.');
                }
            } catch (err) {
                console.error('Sign-in error:', err);
                alert('Connection error. Please try again.');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign In'; }
            }
        });
    }

    // Handle Sign Up Submit (Trigger Email Verification)
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

            // Strict 11-digit numeric phone validation
            const phoneRegex = /^09\d{9}$/;
            if (!phoneRegex.test(phone)) {
                alert('Phone number must contain strictly 11 digits starting with 09 (e.g., 09123456789).');
                return;
            }

            if (password !== passwordConfirm) {
                alert('Passwords do not match. Please re-enter.');
                return;
            }

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending Code...'; }

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

                if (result.status === 'verification_required') {
                    currentVerifyingEmail = email;
                    document.getElementById('verify-email-display').textContent = email;
                    showBox(verifyBox);
                } else {
                    alert(result.message || 'Registration failed.');
                }
            } catch (err) {
                console.error('Sign-up error:', err);
                alert('Connection error. Please check your network or server.');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign Up'; }
            }
        });
    }

    // Handle Email Verification Submit
    if (verifyForm) {
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-verify-submit');
            const code = document.getElementById('verify-code').value.trim();

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Verifying...'; }

            try {
                const response = await fetch('/api/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentVerifyingEmail, code })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    alert(result.message);
                    signUpForm.reset();
                    verifyForm.reset();
                    showBox(signInBox);
                } else {
                    alert(result.message || 'Verification failed.');
                }
            } catch (err) {
                console.error('Verify error:', err);
                alert('Connection error.');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Verify & Complete Registration'; }
            }
        });

        const resendBtn = document.getElementById('btn-resend-code');
        if (resendBtn) {
            resendBtn.addEventListener('click', async () => {
                try {
                    const response = await fetch('/api/resend-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: currentVerifyingEmail })
                    });
                    const result = await response.json();
                    alert(result.message);
                } catch (err) {
                    alert('Failed to resend code.');
                }
            });
        }
    }

    // Handle Forgot Password Request
    if (forgotForm) {
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-forgot-submit');
            const email = document.getElementById('forgot-email').value.trim();

            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending...'; }

            try {
                const response = await fetch('/api/forgot-password/request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const result = await response.json();

                if (result.status === 'success') {
                    currentVerifyingEmail = email;
                    showBox(resetBox);
                } else {
                    alert(result.message || 'Failed to process request.');
                }
            } catch (err) {
                alert('Connection error.');
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Send Reset Code'; }
            }
        });
    }

    // Handle Password Reset
    if (resetForm) {
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('reset-code').value.trim();
            const newPassword = document.getElementById('reset-pass').value;
            const confirmPassword = document.getElementById('reset-pass-confirm').value;

            if (newPassword !== confirmPassword) {
                alert('New passwords do not match.');
                return;
            }

            try {
                const verifyRes = await fetch('/api/forgot-password/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentVerifyingEmail, code })
                });
                const verifyResult = await verifyRes.json();

                if (verifyResult.status !== 'success') {
                    alert(verifyResult.message || 'Invalid reset code.');
                    return;
                }

                const resetRes = await fetch('/api/forgot-password/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: currentVerifyingEmail,
                        new_password: newPassword,
                        confirm_password: confirmPassword
                    })
                });
                const resetResult = await resetRes.json();

                if (resetResult.status === 'success') {
                    alert(resetResult.message);
                    resetForm.reset();
                    showBox(signInBox);
                } else {
                    alert(resetResult.message || 'Password reset failed.');
                }
            } catch (err) {
                alert('Connection error.');
            }
        });
    }
});
