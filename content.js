// Content script for Smart Summarizer Extension
// This script runs on all web pages to help with content extraction

// Initialize content script
console.log("🧠 Smart Summarizer content script loaded");

// Enhanced content extraction with better text cleaning
function getCleanPageContent() {
  // Remove unwanted elements
  const unwantedSelectors = [
    'script', 'style', 'nav', 'footer', 'header', 
    '.advertisement', '.ads', '.ad', '.sidebar', 
    '.cookie-banner', '.popup', '.modal',
    '[class*="ad-"]', '[id*="ad-"]'
  ];
  
  // Create a clone to avoid modifying the original page
  const pageClone = document.cloneNode(true);
  
  unwantedSelectors.forEach(selector => {
    pageClone.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Try to find main content area
  const mainContentSelectors = [
    'main', 'article', '[role="main"]',
    '.main-content', '.content', '#content',
    '.post-content', '.entry-content', 
    '.article-content', '.page-content'
  ];
  
  let mainContent = null;
  for (const selector of mainContentSelectors) {
    mainContent = pageClone.querySelector(selector);
    if (mainContent) break;
  }
  
  // Fallback to body if no main content found
  if (!mainContent) {
    mainContent = pageClone.body || pageClone;
  }
  
  return {
    title: document.title || "بدون عنوان",
    content: mainContent.textContent || mainContent.innerText || "",
    url: window.location.href,
    lang: document.documentElement.lang || "en"
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    try {
      const pageData = getCleanPageContent();
      sendResponse({
        success: true,
        data: pageData
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  
  if (request.action === "highlightText") {
    // Enhanced highlighting with better text matching
    highlightTextInPage(request.text, request.content);
    sendResponse({success: true});
  }
  
  if (request.action === "scrollToSection") {
    // New functionality to scroll to specific section
    scrollToSection(request.sectionTitle, request.sectionContent);
    sendResponse({success: true});
  }
  
  return true; // Keep message channel open
});

// Enhanced scrolling to section
function scrollToSection(title, content) {
  // Remove previous highlights first
  document.querySelectorAll('.smart-summarizer-highlight, .smart-summarizer-section').forEach(el => {
    el.classList.remove('smart-summarizer-highlight', 'smart-summarizer-section');
  });
  
  // Try to find the exact heading
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let targetElement = null;
  
  for (const heading of headings) {
    const headingText = heading.textContent.trim().toLowerCase();
    const titleText = title.toLowerCase();
    
    if (headingText.includes(titleText) || titleText.includes(headingText)) {
      targetElement = heading;
      break;
    }
  }
  
  // If heading not found, try to find by content
  if (!targetElement && content) {
    const contentPreview = content.substring(0, 50).toLowerCase();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent.toLowerCase();
      if (nodeText.includes(contentPreview)) {
        targetElement = node.parentElement;
        break;
      }
    }
  }
  
  if (targetElement) {
    // Add highlighting class
    targetElement.classList.add('smart-summarizer-section');
    
    // Add temporary highlight style
    const style = document.createElement('style');
    style.textContent = `
      .smart-summarizer-section {
        background-color: #fffbeb !important;
        border-left: 4px solid #f59e0b !important;
        padding: 8px !important;
        border-radius: 4px !important;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.2) !important;
        transition: all 0.3s ease !important;
      }
    `;
    document.head.appendChild(style);
    
    // Smooth scroll to element
    targetElement.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center' 
    });
    
    // Remove highlight after 3 seconds
    setTimeout(() => {
      targetElement.classList.remove('smart-summarizer-section');
      style.remove();
    }, 3000);
    
    return true;
  }
  
  return false;
}

// Enhanced highlight text functionality
function highlightTextInPage(searchText, additionalContent = "") {
  if (!searchText || searchText.length < 3) return;
  
  // Remove previous highlights
  document.querySelectorAll('.smart-summarizer-highlight').forEach(el => {
    const parent = el.parentNode;
    parent.replaceChild(document.createTextNode(el.textContent), el);
    parent.normalize();
  });
  
  // Remove old styles
  const oldStyles = document.querySelectorAll('style[data-smart-summarizer]');
  oldStyles.forEach(style => style.remove());
  
  // Add highlight styles
  const style = document.createElement('style');
  style.setAttribute('data-smart-summarizer', 'true');
  style.textContent = `
    .smart-summarizer-highlight {
      background: linear-gradient(120deg, #ffd700 0%, #ffed4e 100%) !important;
      padding: 2px 4px !important;
      border-radius: 3px !important;
      font-weight: bold !important;
      color: #333 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2) !important;
      animation: highlightPulse 0.5s ease-in-out !important;
    }
    
    @keyframes highlightPulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
  
  // Find and highlight text
  const searchTerms = [searchText];
  if (additionalContent) {
    // Extract key phrases from additional content
    const words = additionalContent.split(/\s+/).filter(word => 
      word.length > 4 && 
      !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'از', 'در', 'به', 'با', 'که', 'این', 'آن'].includes(word.toLowerCase())
    );
    searchTerms.push(...words.slice(0, 3)); // Add up to 3 key words
  }
  
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script and style elements
        const parentTag = node.parentNode.tagName;
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  let highlightCount = 0;
  textNodes.forEach(textNode => {
    if (highlightCount > 10) return; // Limit highlights to avoid performance issues
    
    const text = textNode.textContent;
    let modifiedText = text;
    let hasHighlight = false;
    
    searchTerms.forEach(term => {
      const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\// Highlight text functionality
function highlightTextInPage(searchText) {
  if (!searchText || searchText.length < 10) return;
  
  // Remove previous highlights
  document.querySelectorAll('.smart-summarizer-highlight').forEach(el => {
    el.outerHTML = el.innerHTML;
  });
  
  // Simple text highlighting
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const index = text.toLowerCase().indexOf(searchText.toLowerCase());')})`, 'gi');
      if (regex.test(modifiedText)) {
        modifiedText = modifiedText.replace(regex, '<span class="smart-summarizer-highlight">$1</span>');
        hasHighlight = true;
        highlightCount++;
      }
    });
    
    if (hasHighlight) {
      const wrapper = document.createElement('span');
      wrapper.innerHTML = modifiedText;
      textNode.parentNode.replaceChild(wrapper, textNode);
    }
  });
  
  // Auto-remove highlights after 10 seconds
  setTimeout(() => {
    document.querySelectorAll('.smart-summarizer-highlight').forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
    style.remove();
  }, 10000);
  
  return highlightCount > 0;
}
    
    if (index !== -1) {
      const beforeText = text.substring(0, index);
      const matchedText = text.substring(index, index + searchText.length);
      const afterText = text.substring(index + searchText.length);
      
      const wrapper = document.createElement('span');
      wrapper.innerHTML = beforeText + 
        '<span class="smart-summarizer-highlight" style="background-color: yellow; padding: 2px 4px; border-radius: 3px;">' + 
        matchedText + '</span>' + afterText;
      
      textNode.parentNode.replaceChild(wrapper, textNode);
    }
  });
}

// Detect page language for better summarization
function detectPageLanguage() {
  const lang = document.documentElement.lang || 
               document.querySelector('meta[http-equiv="content-language"]')?.content ||
               document.querySelector('meta[name="language"]')?.content ||
               "en";
  
  return lang.substring(0, 2).toLowerCase();
}

// Auto-detect if page content is suitable for summarization
function isPageSummarizable() {
  const content = document.body.textContent || "";
  const wordCount = content.split(/\s+/).length;
  
  // Skip pages that are too short or likely not content pages
  if (wordCount < 100) return false;
  
  // Skip pages with mostly forms or navigation
  const forms = document.querySelectorAll('form').length;
  const links = document.querySelectorAll('a').length;
  const textLength = content.length;
  
  if (forms > 5 || (links > 50 && textLength < 2000)) return false;
  
  return true;
}

// Initialize page analysis
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const isReady = isPageSummarizable();
    const language = detectPageLanguage();
    
    // Send page readiness info to background script
    chrome.runtime.sendMessage({
      action: "pageAnalyzed",
      data: {
        ready: isReady,
        language: language,
        wordCount: (document.body.textContent || "").split(/\s+/).length,
        url: window.location.href
      }
    }).catch(() => {
      // Ignore errors if background script is not ready
    });
  }, 1000);
});

// Export functions for popup injection
window.smartSummarizerUtils = {
  getCleanPageContent,
  detectPageLanguage,
  isPageSummarizable,
  highlightTextInPage
};