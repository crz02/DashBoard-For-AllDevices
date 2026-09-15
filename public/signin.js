/* ==========================================================================
   Statuser — Sign-In Logic
   Clerk JS is loaded dynamically from /api/config. No hardcoded keys.
   ========================================================================== */

(function () {
  'use strict';

  const loadingBox   = document.getElementById('loadingBox');
  const loadingLabel = document.getElementById('loadingLabel');
  const errorBox     = document.getElementById('errorBox');
  const clerkMount   = document.getElementById('clerkMount');

  /* ── UI helpers ──────────────────────────────────────────────────────── */

  function setLoading(text) {
    if (loadingLabel) loadingLabel.textContent = text;
  }

  function hideLoading() {
    if (loadingBox) loadingBox.style.display = 'none';
    if (clerkMount) clerkMount.style.display = 'block';
  }

  function showError(html) {
    hideLoading();
    if (clerkMount) clerkMount.innerHTML = '';
    if (errorBox) { errorBox.style.display = 'block'; errorBox.innerHTML = html; }
  }

  function toast(msg, type) {
    const stack = document.getElementById('toastStack');
    if (!stack) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'ok' ? 'ok' : 'err');
    t.textContent = msg;
    stack.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  /* ── Redirect after login ────────────────────────────────────────────── */

  function handleSignedIn(user, autoRedirect = true) {
    if (!user) return;
    const email = user.primaryEmailAddress?.emailAddress || '';
    const name  = user.fullName || user.firstName || email.split('@')[0] || 'User';

    // Sync to backend
    fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id, email, name, avatar_url: user.imageUrl
      }),
    }).catch(() => {});

    // Store session locally
    localStorage.setItem('omniverse_auth_user', JSON.stringify({
      id: user.id, name, email, avatar_url: user.imageUrl,
      provider: 'clerk', signedInAt: new Date().toISOString()
    }));

    if (autoRedirect) {
      toast(`Welcome, ${name}!`, 'ok');
      setTimeout(() => { window.location.href = '/'; }, 900);
    }
  }

  /* ── Frontend API derivation from Clerk Key ─────────────────────────── */

  function deriveFrontendApi(publishableKey) {
    try {
      const parts = publishableKey.split('_');
      if (parts.length >= 3) {
        const b64 = parts[2];
        const decoded = atob(b64);
        return decoded.replace(/\$$/, '');
      }
    } catch (_) {}
    return null;
  }

  async function loadClerkSdk(publishableKey) {
    if (window.Clerk) return window.Clerk;

    const frontendApi = deriveFrontendApi(publishableKey);
    if (!frontendApi) {
      throw new Error('Could not derive Clerk Frontend API from the publishable key.');
    }

    const cdnUrl = `https://${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-clerk-publishable-key', publishableKey);
    script.src = cdnUrl;
    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      if (window.Clerk) return resolve(window.Clerk);
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (window.Clerk) {
          clearInterval(interval);
          resolve(window.Clerk);
        } else if (attempts > 60) {
          clearInterval(interval);
          reject(new Error('Timed out waiting for Clerk SDK from ' + cdnUrl));
        }
      }, 250);
    });
  }

  /* ── Main init ───────────────────────────────────────────────────────── */

  async function start() {
    setLoading('Loading configuration…');

    // Fetch publishable key from server config
    let clerkKey = '';
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.clerk_publishable_key) {
          clerkKey = data.clerk_publishable_key;
        }
      }
    } catch (_) {}

    if (!clerkKey || (!clerkKey.startsWith('pk_test_') && !clerkKey.startsWith('pk_live_'))) {
      showError(
        '<strong>Authentication is not configured.</strong><br>' +
        'To enable sign-in, add your Clerk publishable key to the <code>.env</code> file:<br>' +
        '<code>CLERK_PUBLISHABLE_KEY=pk_test_...</code><br><br>' +
        'The dashboard works without authentication — ' +
        '<a href="/" style="color:var(--blue);text-decoration:underline;">← Go to Dashboard</a>'
      );
      return;
    }

    setLoading('Loading Clerk SDK…');
    try {
      await loadClerkSdk(clerkKey);
    } catch (err) {
      showError(
        '<strong>Could not load the Clerk SDK.</strong><br>' +
        'Check your internet connection and Clerk key, then reload.<br><br>' +
        `<small style="opacity:.7">${err.message}</small>`
      );
      return;
    }

    const clerkAppearance = {
      variables: {
        colorPrimary: '#1f6feb',
        colorBackground: '#161b22',
        colorInputBackground: '#0d1117',
        colorInputText: '#f0f6fc',
        colorText: '#f0f6fc',
        colorTextSecondary: '#8b949e',
        colorTextOnPrimaryBackground: '#ffffff',
        colorNeutral: '#f0f6fc',
        borderRadius: '8px',
      },
      elements: {
        card: {
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '12px',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.55)',
          padding: '32px 28px',
        },
        socialButtonsBlockButton: {
          backgroundColor: '#21262d',
          borderColor: '#38444d',
          color: '#f0f6fc',
          '&:hover': {
            backgroundColor: '#282f37',
            borderColor: '#58a6ff',
          },
        },
        socialButtonsBlockButtonText: {
          color: '#f0f6fc',
          fontWeight: '600',
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
        },
        socialButtonsIconButton: {
          backgroundColor: '#21262d',
          borderColor: '#38444d',
          '&:hover': {
            backgroundColor: '#282f37',
            borderColor: '#58a6ff',
          },
        },
        formFieldInput: {
          backgroundColor: '#0d1117',
          borderColor: '#30363d',
          color: '#f0f6fc',
        },
        footer: {
          background: '#12161c',
          backgroundImage: 'none',
        },
        footerActionText: {
          color: '#8b949e',
        },
        footerActionLink: {
          color: '#58a6ff',
        },
      }
    };

    setLoading('Initialising Clerk…');
    try {
      await window.Clerk.load({ appearance: clerkAppearance });
    } catch (e) {
      showError(
        '<strong>Clerk failed to initialise.</strong><br>' +
        'This usually means an invalid publishable key or a network issue.<br>' +
        `<small style="opacity:.7">${e.message}</small>`
      );
      return;
    }

    // Handle signout requested via query param (?signout=true) or hash (#signout)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('signout') === 'true' || window.location.hash.includes('signout')) {
      if (window.Clerk.user) {
        try { await window.Clerk.signOut(); } catch (_) {}
      }
      localStorage.removeItem('omniverse_auth_user');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!window.Clerk.user) {
      // Clear stale Clerk user session if any
      try {
        const stored = JSON.parse(localStorage.getItem('omniverse_auth_user') || 'null');
        if (stored && stored.provider === 'clerk') {
          localStorage.removeItem('omniverse_auth_user');
        }
      } catch (_) {}

      hideLoading();
      clerkMount.innerHTML = '';
      window.Clerk.mountSignIn(clerkMount, {
        routing:        'hash',
        afterSignInUrl: '/',
        afterSignUpUrl: '/',
        appearance: clerkAppearance,
      });

      // Continuous DOM cleanup for Clerk dev mode stripe overlays
      const cleanupObserver = new MutationObserver(() => {
        clerkMount.querySelectorAll('div').forEach(el => {
          if (el.children.length === 0) {
            const style = window.getComputedStyle(el);
            if (style.position === 'absolute' && (style.backgroundImage.includes('gradient') || el.className.includes('internal'))) {
              el.remove();
            }
          }
        });
      });
      cleanupObserver.observe(clerkMount, { childList: true, subtree: true });

      window.Clerk.addListener(({ user }) => {
        if (user) handleSignedIn(user, true);
      });
      return;
    }

    // Already signed in via Clerk
    const email = window.Clerk.user.primaryEmailAddress?.emailAddress || '';
    const name = window.Clerk.user.fullName || window.Clerk.user.firstName || email.split('@')[0] || 'User';

    handleSignedIn(window.Clerk.user, false);
    hideLoading();

    clerkMount.innerHTML = `
      <div class="cl-card" style="text-align:center;padding:36px 24px;">
        <div style="width:56px;height:56px;border-radius:50%;background:#1f6feb;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;margin-bottom:16px;box-shadow:0 0 20px rgba(31,111,235,0.4);">
          ${(name[0] || 'U').toUpperCase()}
        </div>
        <h3 style="font-size:1.15rem;font-weight:700;color:var(--text-main);margin-bottom:6px;">${escapeHtml(name)}</h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:28px;">${escapeHtml(email)}</p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <a href="/" class="btn" style="flex:1;justify-content:center;background:var(--blue-btn);color:#fff;border-color:var(--blue-btn);font-weight:600;padding:10px 16px;border-radius:8px;">Go to Dashboard</a>
          <button id="signinSignOutBtn" class="btn" style="flex:1;justify-content:center;color:var(--red);border-color:rgba(248,81,73,0.35);padding:10px 16px;border-radius:8px;">Sign Out</button>
        </div>
      </div>
    `;

    document.getElementById('signinSignOutBtn')?.addEventListener('click', async () => {
      setLoading('Signing out…');
      try {
        await window.Clerk.signOut();
      } catch (_) {}
      localStorage.removeItem('omniverse_auth_user');
      window.location.reload();
    });
  }

  // Start initialization
  start();

})();
