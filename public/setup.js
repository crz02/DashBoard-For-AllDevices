(() => {
  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      const status = button.parentElement.querySelector('.copy-status');
      const text = target?.querySelector('code')?.textContent?.trim();

      if (!text || !status) return;

      try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied';
        button.dataset.copyState = 'copied';
        status.textContent = 'Copied to clipboard.';
      } catch (error) {
        console.error('Could not copy setup text:', error);
        button.textContent = 'Failed';
        button.dataset.copyState = 'error';
        status.textContent = 'Could not copy. Select and copy the text manually.';
      }

      window.setTimeout(() => {
        button.textContent = 'Copy';
        delete button.dataset.copyState;
        status.textContent = '';
      }, 1800);
    });
  });
})();
