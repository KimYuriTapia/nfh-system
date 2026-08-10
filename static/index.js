document.addEventListener('DOMContentLoaded', () => {
    const signInBox = document.getElementById('signin-box');
    const signUpBox = document.getElementById('signup-box');
    const verificationBox = document.getElementById('verification-box');

    const toSignUpBtn = document.getElementById('to-signup');
    const toSignInBtn = document.getElementById('to-signin');
    const backToSignUpBtn = document.getElementById('back-to-signup');
    const resendSignupCodeBtn = document.getElementById('resend-signup-code');

    const signInForm = document.getElementById('signin-form');
    const signUpForm = document.getElementById('signup-form');
    const verificationForm = document.getElementById('verification-form');
    const verificationCodeInput = document.getElementById('verificationCode');

    let currentRegisteredEmail = null;

    function showBox(boxToShow) {
        [signInBox, signUpBox, verificationBox].forEach(box => {
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

    if (backToSignUpBtn) {
        backToSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showBox(signUpBox);
        });
    }

    if (verificationCodeInput) {
        verificationCodeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
        });
    }

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

            if (!/^09\d{9}$/.test(phone)) {
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

                if (result.status === 'success' && result.verification_required) {
                    currentRegisteredEmail = email;
                    const emailDisplay = document.getElementById('verify-email-display');
                    if (emailDisplay) emailDisplay.textContent = email;

                    showBox(verificationBox);
                    if (verificationCodeInput) verificationCodeInput.focus();
                } else {
                    alert(result.message || 'We could not send the verification code. Please try again.');
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

    if (resendSignupCodeBtn) {
        resendSignupCodeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!currentRegisteredEmail) {
                alert('Registration details missing. Please complete registration again.');
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

    if (verificationForm) {
        verificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = verificationCodeInput.value.trim();
            const submitBtn = document.getElementById('btn-verify-submit');

            if (code.length !== 6) {
                alert('Please enter a valid 6-digit verification code.');
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verifying...';
            }

            try {
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
                    submitBtn.textContent = 'Verify Email';
                }
            }
        });
    }
});
