/**
 * EdgeCTUMP Background Service Worker
 * Enables native side panel behavior on action click.
 */

chrome.runtime.onInstalled.addListener(() => {
  // Configure browser to open Side Panel when extension icon is clicked
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("setPanelBehavior failed:", error));
  }
});

// Fallback listener for environments requiring programmatic sidePanel.open
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (chrome.sidePanel && chrome.sidePanel.open && tab && tab.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
      }
    } catch (err) {
      console.warn("sidePanel.open fallback warning:", err);
    }
  });
}
