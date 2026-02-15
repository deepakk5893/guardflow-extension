/**
 * Block Page Script
 *
 * Handles the blocked page UI and navigation actions.
 */

// Parse URL params
const urlParams = new URLSearchParams(window.location.search);
const blockedDomain = urlParams.get('domain') || 'Unknown Site';
const blockedName = urlParams.get('name') || blockedDomain;
const blockedCategory = urlParams.get('category') || '';

// Display site information
const siteNameEl = document.getElementById('siteName');
const siteCategoryEl = document.getElementById('siteCategory');

if (siteNameEl) {
  siteNameEl.textContent = blockedName;
}

if (siteCategoryEl && blockedCategory) {
  // Format category for display (e.g., "code_assistant" -> "Code Assistant")
  const formattedCategory = blockedCategory
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  siteCategoryEl.textContent = formattedCategory;
}

// Update page title
document.title = `Blocked: ${blockedName} - Niyantra`;

// Go Back button
const goBackBtn = document.getElementById('goBack');
if (goBackBtn) {
  goBackBtn.addEventListener('click', () => {
    // Try to go back in history
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If no history, try to close the tab
      window.close();
      // If window.close() doesn't work (not opened by script), go to new tab page
      setTimeout(() => {
        window.location.href = 'about:blank';
      }, 100);
    }
  });
}

// Close Tab button
const closeTabBtn = document.getElementById('closeTab');
if (closeTabBtn) {
  closeTabBtn.addEventListener('click', () => {
    window.close();
    // Fallback if close doesn't work
    setTimeout(() => {
      window.location.href = 'about:blank';
    }, 100);
  });
}

// Prevent navigating back to blocked site via browser back button
// This is a safety measure - the webNavigation listener should catch it anyway
window.addEventListener('popstate', () => {
  // Stay on block page
  window.history.pushState(null, '', window.location.href);
});

// Push initial state to prevent immediate back navigation
window.history.pushState(null, '', window.location.href);

console.log('[Niyantra] Block page loaded for:', blockedDomain);
