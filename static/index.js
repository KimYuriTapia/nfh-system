document.addEventListener('DOMContentLoaded', () => {
    const signInBox = document.getElementById('signin-box');
    const signUpBox = document.getElementById('signup-box');
    const forgotBox = document.getElementById('forgot-box');
    const verificationBox = document.getElementById('verification-box');

    const toSignUpBtn = document.getElementById('to-signup');
    const toSignInBtn = document.getElementById('to-signin');
    const toForgotPasswordBtn = document.getElementById('to-forgot-password');
    const forgotToSignInBtn = document.getElementById('forgot-to-signin');
    const backToSignUpBtn = document.getElementById('back-to-signup');
    const resendSignupCodeBtn = document.getElementById('resend-signup-code');

    const signInForm = document.getElementById('signin-form');
    const signUpForm = document.getElementById('signup-form');
    const verificationForm = document.getElementById('verification-form');
    const forgotEmailForm = document.getElementById('forgot-email-form');
    const forgotCodeForm = document.getElementById('forgot-code-form');
    const forgotResetForm = document.getElementById('forgot-reset-form');

    let currentRegisteredEmail = null;
    let pendingForgotEmail = null;

    function showBox(boxToShow) {
        [signInBox, signUpBox, forgotBox, verificationBox].forEach(box => {
            if (box) box.style.display = 'none';
        });
        if (boxToShow) boxToShow.style.display = 'block';
    }

    if (toSignUpBtn) {
        toSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(signUpBox);
        });
    }

    if (toSignInBtn) {
        toSignInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(signInBox);
        });
    }

    if (toForgotPasswordBtn) {
        toForgotPasswordBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(forgotBox);
            if (forgotEmailForm) forgotEmailForm.style.display = 'block';
            if (forgotCodeForm) forgotCodeForm.style.display = 'none';
            if (forgotResetForm) forgotResetForm.style.display = 'none';
        });
    }

    if (forgotToSignInBtn) {
        forgotToSignInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(signInBox);
        });
    }

    if (backToSignUpBtn) {
        backToSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(signUpBox);
        });
    }

    // Sign In Submit
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
                    window.location.href = result.redirect || '/';
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

    // Signup Submit -> Validate & Request Verification Code
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const firstName = document.getElementById('reg-first').value.trim();
            const lastName = document.getElementById('reg-last').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const username = document.getElementById('reg-user').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const password = document.getElementById('reg-pass').value;
            const passwordConfirm = document.getElementById('reg-pass-confirm').value;

            const phPhoneRegex = /^09\d{9}$/;
            if (!phPhoneRegex.test(phone)) {
                alert('Phone number must be exactly 11 digits starting with 09 (e.g. 09123456789).');
                return;
            }

            if (password !== passwordConfirm) {
                alert('Passwords do not match.');
                return;
            }

            const submitBtn = document.getElementById('btn-signup-submit');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending Verification Code...';
            }

            try {
                const response = await fetch('/api/send-verification-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name: firstName,
                        last_name: lastName,
                        email: email,
                        username: username,
                        phone: phone,
                        password: password,
                        password_confirm: passwordConfirm,
                        purpose: 'register'
                    })
                });

                const result = await response.json();

                if (result.status === 'success') {
                    currentRegisteredEmail = email;
                    const subTitle = document.getElementById('verify-email-subtitle');
                    if (subTitle) subTitle.textContent = `We sent a verification code to ${email}`;
                    showBox(verificationBox);
                } else {
                    alert(result.message || 'Failed to send verification code.');
                }
            } catch (err) {
                console.error('Registration dispatch error:', err);
                alert('We could not send the verification code. Please try again.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Sign Up';
                }
            }
        });
    }

    // Resend Signup Code
    if (resendSignupCodeBtn) {
        resendSignupCodeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentRegisteredEmail) {
                alert('Registration email missing. Please fill out registration form again.');
                showBox(signUpBox);
                return;
            }

            try {
                const response = await fetch('/api/send-verification-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: currentRegisteredEmail,
                        first_name: document.getElementById('reg-first').value.trim(),
                        last_name: document.getElementById('reg-last').value.trim(),
                        username: document.getElementById('reg-user').value.trim(),
                        phone: document.getElementById('reg-phone').value.trim(),
                        password: document.getElementById('reg-pass').value,
                        password_confirm: document.getElementById('reg-pass-confirm').value,
                        purpose: 'register'
                    })
                });
                const result = await response.json();
                alert(result.message || 'New verification code requested.');
            } catch (err) {
                alert('Error resending verification code. Please try again.');
            }
        });
    }

    // Verification Code Submit -> Verify & Create Account
    if (verificationForm) {
        verificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('verify-code').value.trim();
            const submitBtn = document.getElementById('btn-verify-submit');

            if (!currentRegisteredEmail) {
                alert('Email session missing. Please start registration again.');
                showBox(signUpBox);
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying Code...';
            }

            try {
                // Step 1: Verify Code
                const verifyRes = await fetch('/api/verify-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentRegisteredEmail, code: code })
                });
                const verifyResult = await verifyRes.json();

                if (verifyResult.status !== 'success') {
                    alert(verifyResult.message || 'Invalid verification code.');
                    return;
                }

                // Step 2: Create Account upon Successful Verification
                const regRes = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentRegisteredEmail })
                });
                const regResult = await regRes.json();

                if (regResult.status === 'success') {
                    alert('Verification Successful! Account created. You can now log in.');
                    if (signUpForm) signUpForm.reset();
                    if (verificationForm) verificationForm.reset();
                    currentRegisteredEmail = null;
                    showBox(signInBox);
                } else {
                    alert(regResult.message || 'Account creation failed.');
                }
            } catch (err) {
                console.error('Verification error:', err);
                alert('Connection error. Please try again.');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Complete Registration';
                }
            }
        });
    }

    // Forgot Password Email Submit
    if (forgotEmailForm) {
        forgotEmailForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('forgot-email').value.trim();
            const sendBtn = document.getElementById('btn-forgot-send');

            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Verifying Account...';
            }

            try {
                const response = await fetch('/api/send-verification-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, purpose: 'forgot_password' })
                });
                const result = await response.json();

                if (result.status === 'success') {
                    pendingForgotEmail = email;
                    forgotEmailForm.style.display = 'none';
                    if (forgotCodeForm) forgotCodeForm.style.display = 'block';
                } else {
                    alert(result.message || 'Failed to verify account.');
                }
            } catch (err) {
                console.error('Forgot password error:', err);
                alert('Connection error. Please try again.');
            } finally {
                if (sendBtn) {
                    sendBtn.disabled = false;
                    sendBtn.textContent = 'Send Verification Code';
                }
            }
        });
    }

    // Forgot Password Verification Submit
    if (forgotCodeForm) {
        forgotCodeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('forgot-code').value.trim();
            const verifyBtn = document.getElementById('btn-forgot-verify');

            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'Verifying Code...';
            }

            try {
                const response = await fetch('/api/verify-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: pendingForgotEmail, code: code })
                });
                const result = await response.json();

                if (result.status === 'success') {
                    forgotCodeForm.style.display = 'none';
                    if (forgotResetForm) forgotResetForm.style.display = 'block';
                } else {
                    alert(result.message || 'Invalid verification code.');
                }
            } catch (err) {
                console.error('Code verification error:', err);
                alert('Connection error. Please try again.');
            } finally {
                if (verifyBtn) {
                    verifyBtn.disabled = false;
                    verifyBtn.textContent = 'Verify Code';
                }
            }
        });
    }

    // Forgot Password Reset Submit
    if (forgotResetForm) {
        forgotResetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('forgot-new-pass').value;
            const confirmPassword = document.getElementById('forgot-conf-pass').value;
            const resetBtn = document.getElementById('btn-forgot-reset');

            if (newPassword !== confirmPassword) {
                alert('Passwords do not match.');
                return;
            }

            if (resetBtn) {
                resetBtn.disabled = true;
                resetBtn.textContent = 'Updating Password...';
            }

            try {
                const response = await fetch('/api/forgot-password/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: pendingForgotEmail,
                        new_password: newPassword,
                        confirm_password: confirmPassword
                    })
                });
                const result = await response.json();

                if (result.status === 'success') {
                    alert('Password successfully updated.');
                    forgotEmailForm.reset();
                    forgotCodeForm.reset();
                    forgotResetForm.reset();
                    pendingForgotEmail = null;
                    showBox(signInBox);
                } else {
                    alert(result.message || 'Failed to update password.');
                }
            } catch (err) {
                console.error('Password reset error:', err);
                alert('Connection error. Please try again.');
            } finally {
                if (resetBtn) {
                    resetBtn.disabled = false;
                    resetBtn.textContent = 'Reset Password';
                }
            }
        });
    }
});
