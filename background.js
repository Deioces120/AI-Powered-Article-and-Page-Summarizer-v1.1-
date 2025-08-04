// Enhanced background script for Smart Summarizer
chrome.runtime.onInstalled.addListener((details) => {
  console.log("🧠 Smart Summarizer Extension Installed");
  
  if (details.reason === "install") {
    // Set default settings
    chrome.storage.sync.set({
      maxSummaryLength: 150,
      summaryLanguage: "auto",
      showEmojis: true,
      autoDetectLanguage: true,
      theme: "default"
    });
    
    // Show welcome notification
    showWelcomeNotification();
  }
});

// Context menu for quick summarization
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "quickSummarize",
    title: "🚀Quick summary of this section",
    contexts: ["selection"]
  });
  
  chrome.contextMenus.create({
    id: "fullPageSummary",
    title: "📄 Full page summary",
    contexts: ["page"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "quickSummarize" && info.selectionText) {
    // Send selected text to popup for summarization
    chrome.storage.local.set({
      selectedText: info.selectionText,
      action: "summarize"
    });
  } else if (info.menuItemId === "fullPageSummary") {
    // Trigger full page summary
    chrome.storage.local.set({
      action: "fullPageSummary"
    });
  }
});

// Listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Open popup (this is handled automatically, but we can add logic here if needed)
  console.log("Extension clicked on tab:", tab.url);
});

// Monitor tab changes for auto-summarization (if user enables it)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Check if auto-summarization is enabled
    chrome.storage.sync.get(['autoSummarize'], (result) => {
      if (result.autoSummarize) {
        // Could implement background summarization here
        console.log("Page loaded, ready for auto-summarization");
      }
    });
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageInfo") {
    // Get current tab info
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title,
          id: tabs[0].id
        });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.action === "showNotification") {
    // Show notification for completed actions
    showNotification(request.title, request.message);
  }
});

function showWelcomeNotification() {
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiM0Mjk5ZTEiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPgo8cGF0aCBkPSJtOSAxMiAyIDIgNC00Ii8+CjxwYXRoIGQ9Im0yMSAyMS0zLTMtMyAzIDMgM3oiLz4KPC9zdmc+Cjwvc3ZnPg==',
      title: '🧠 Smart Summarizer',
      message: 'The plugin has been successfully installed! You can now summarize pages..'
    });
  }
}

function showNotification(title, message) {
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjQiIGN5PSIyNCIgcj0iMjQiIGZpbGw9IiM0Q0FGNTAILE9MZ5Cjwvc3ZnPgo8L3N2Zz4K',
      title: title,
      message: message
    });
  }
}
