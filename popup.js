const huggingfaceApiKey = "YOUR\_API\_KEY\_HERE";

let currentPageText = "";
let currentMode = "summary";

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById("quickSummarizeBtn").addEventListener("click", quickSummarize);
  document.getElementById("treeViewBtn").addEventListener("click", generateTreeView);
  
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
  });
}

function switchTab(tabName) {
  // Update tab appearance
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  
  // Show/hide content
  if (tabName === 'summary') {
    document.getElementById('summary').style.display = 'block';
    document.getElementById('treeContainer').style.display = 'none';
  } else {
    document.getElementById('summary').style.display = 'none';
    document.getElementById('treeContainer').style.display = 'block';
  }
  
  currentMode = tabName;
}

function showError(message) {
  const errorDiv = document.getElementById("error");
  errorDiv.textContent = `❌ Error: ${message}`;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function updateStats(text, sections = 0) {
  const words = text.split(/\s+/).filter(word => word.length > 0).length;
  const readTime = Math.ceil(words / 200); // 200 words per minute average
  
  document.getElementById('wordCount').textContent = words.toLocaleString();
  document.getElementById('sectionCount').textContent = sections;
  document.getElementById('readTime').textContent = readTime;
  document.getElementById('stats').style.display = 'flex';
}

async function quickSummarize() {
  const btn = document.getElementById("quickSummarizeBtn");
  const summaryArea = document.getElementById("summary");
  
  btn.disabled = true;
  summaryArea.value = "⏳ Reading page content...";
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContent
    }, async (results) => {
      try {
        const pageData = results[0].result;
        currentPageText = pageData.text;
        
        summaryArea.value = "🤖 Generating summary...";
        
        // Smart text chunking for better summarization
        const chunks = smartChunkText(pageData.text, 2000);
        let finalSummary = "";
        
        for (let i = 0; i < Math.min(chunks.length, 3); i++) {
          const chunkSummary = await summarizeText(chunks[i]);
          finalSummary += chunkSummary + "\n\n";
        }
        
        // Add emojis and formatting
        const formattedSummary = formatSummary(finalSummary, pageData.title);
        summaryArea.value = formattedSummary;
        
        updateStats(pageData.text);
        switchTab('summary');
        
      } catch (err) {
        showError(err.message);
        summaryArea.value = "Ready to summarize content... 🤖";
      } finally {
        btn.disabled = false;
      }
    });
  } catch (err) {
    showError("Cannot access page content");
    btn.disabled = false;
  }
}

async function generateTreeView() {
  const btn = document.getElementById("treeViewBtn");
  const treeContainer = document.getElementById("treeContainer");
  
  btn.disabled = true;
  treeContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Analyzing content...</div>';
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractStructuredContent
    }, async (results) => {
      try {
        const structuredData = results[0].result;
        currentPageText = structuredData.fullText;
        
        const treeNodes = await createTreeStructure(structuredData);
        renderTreeView(treeNodes);
        
        updateStats(structuredData.fullText, treeNodes.length);
        switchTab('tree');
        
      } catch (err) {
        showError(err.message);
        treeContainer.innerHTML = '<p style="text-align: center; color: #666;">❌ Error analyzing content</p>';
      } finally {
        btn.disabled = false;
      }
    });
  } catch (err) {
    showError("Cannot access page content");
    btn.disabled = false;
  }
}

// Content extraction functions (to be injected)
function extractPageContent() {
  const title = document.title || "بدون عنوان";
  
  // Remove unwanted elements
  const unwantedSelectors = ['script', 'style', 'nav', 'footer', 'header', '.ad', '.advertisement', '.sidebar'];
  unwantedSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => el.remove());
  });
  
  // Get main content
  const mainContent = document.querySelector('main') || 
                     document.querySelector('article') || 
                     document.querySelector('.content') || 
                     document.querySelector('#content') || 
                     document.body;
  
  const text = mainContent.innerText || document.body.innerText;
  
  return {
    title: title,
    text: text.slice(0, 8000), // Reasonable limit
    url: window.location.href
  };
}

function extractStructuredContent() {
  const title = document.title || "بدون عنوان";
  
  // Find headings and structure
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const sections = [];
  
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.charAt(1));
    const text = heading.textContent.trim();
    
    if (text) {
      // Get content between this heading and the next
      let content = "";
      let nextElement = heading.nextElementSibling;
      
      while (nextElement && !nextElement.matches('h1, h2, h3, h4, h5, h6')) {
        if (nextElement.textContent) {
          content += nextElement.textContent.trim() + " ";
        }
        nextElement = nextElement.nextElementSibling;
      }
      
      sections.push({
        level: level,
        title: text,
        content: content.slice(0, 1500), // Limit content length
        index: index
      });
    }
  });
  
  // If no headings found, split by paragraphs
  if (sections.length === 0) {
    const paragraphs = Array.from(document.querySelectorAll('p'));
    paragraphs.forEach((p, index) => {
      const text = p.textContent.trim();
      if (text.length > 100) {
        sections.push({
          level: 2,
          title: text.substring(0, 50) + "...",
          content: text,
          index: index
        });
      }
    });
  }
  
  return {
    title: title,
    sections: sections,
    fullText: document.body.innerText.slice(0, 10000),
    url: window.location.href
  };
}

// Text processing functions
function smartChunkText(text, maxLength) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = "";
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length < maxLength) {
      currentChunk += sentence + ". ";
    } else {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence + ". ";
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function formatSummary(summary, title) {
  const emojis = ['📌', '🔍', '💡', '⭐', '🎯', '📊', '🔑', '💭'];
  const lines = summary.split('\n').filter(line => line.trim());
  
  let formatted = `🌟 Summary: ${title}\n\n`;
  
  lines.forEach((line, index) => {
    if (line.trim()) {
      const emoji = emojis[index % emojis.length];
      formatted += `${emoji} ${line.trim()}\n\n`;
    }
  });
  
  return formatted;
}

async function createTreeStructure(structuredData) {
  const nodes = [];
  
  for (const section of structuredData.sections) {
    try {
      const summary = section.content.length > 200 ? 
        await summarizeText(section.content) : 
        section.content;
      
      const node = {
        level: section.level,
        title: section.title,
        content: section.content,
        summary: summary,
        emoji: getLevelEmoji(section.level),
        color: getLevelColor(section.level),
        originalIndex: section.index
      };
      
      nodes.push(node);
    } catch (err) {
      // Fallback if summarization fails
      nodes.push({
        level: section.level,
        title: section.title,
        content: section.content,
        summary: section.content.substring(0, 200) + "...",
        emoji: getLevelEmoji(section.level),
        color: getLevelColor(section.level),
        originalIndex: section.index
      });
    }
  }
  
  // Store nodes globally for other functions
  currentNodes = nodes;
  return nodes;
}

function getLevelEmoji(level) {
  const emojis = {
    1: '📚',
    2: '📖',
    3: '📝',
    4: '📄',
    5: '📋',
    6: '📌'
  };
  return emojis[level] || '📎';
}

function getLevelColor(level) {
  const colors = {
    1: 'level-1',
    2: 'level-2',
    3: 'level-3',
    4: 'level-4'
  };
  return colors[level] || 'level-4';
}

function renderTreeView(nodes) {
  const container = document.getElementById('treeContainer');
  
  if (nodes.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">📭 No structured content found</p>';
    return;
  }
  
  let html = '<div style="margin-bottom: 15px; font-weight: bold; color: #2d3748;">🌳 Page Content Structure:</div>';
  
  nodes.forEach((node, index) => {
    html += `
      <div class="tree-node ${node.color}" data-index="${index}">
        <div class="tree-header" onclick="toggleNode(${index})">
          <div>
            <span class="expand-icon" id="icon-${index}">▶</span>
            ${node.emoji} ${node.title}
          </div>
          <div style="display: flex; gap: 5px; align-items: center;">
            <button class="goto-btn" onclick="goToSection(${index})" title="Go to this section">
              🎯
            </button>
            <span style="font-size: 12px; color: #718096;">H${node.level}</span>
          </div>
        </div>
        <div class="tree-content" id="content-${index}">
          <div style="margin-bottom: 8px; font-weight: bold; color: #4299e1;">💡 Summary:</div>
          <div>${node.summary}</div>
          ${node.content.length > 200 ? `
            <details style="margin-top: 8px;">
              <summary style="cursor: pointer; color: #805ad5;">📖 Full Text</summary>
              <div style="margin-top: 5px; padding: 8px; background: #f7fafc; border-radius: 5px; font-size: 12px;">
                ${node.content}
              </div>
            </details>
          ` : ''}
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
            <button class="highlight-btn" onclick="highlightSection(${index})" 
                    style="background: #ffd700; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">
              ✨ Highlight in Page
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function toggleNode(index) {
  const content = document.getElementById(`content-${index}`);
  const icon = document.getElementById(`icon-${index}`);
  
  if (content.classList.contains('expanded')) {
    content.classList.remove('expanded');
    icon.classList.remove('expanded');
  } else {
    content.classList.add('expanded');
    icon.classList.add('expanded');
  }
}

// Make toggleNode available globally
window.toggleNode = toggleNode;
window.goToSection = goToSection;
window.highlightSection = highlightSection;

// Global storage for current nodes
let currentNodes = [];

async function goToSection(index) {
  const node = currentNodes[index];
  if (!node) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to scroll to section
    chrome.tabs.sendMessage(tab.id, {
      action: "scrollToSection",
      sectionTitle: node.title,
      sectionContent: node.content
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Could not scroll to section:", chrome.runtime.lastError.message);
      } else {
        console.log("Scrolled to section successfully");
      }
    });
    
    // Show feedback
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅';
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 1000);
    
  } catch (error) {
    console.error("Error going to section:", error);
  }
}

async function highlightSection(index) {
  const node = currentNodes[index];
  if (!node) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Send message to content script to highlight text
    chrome.tabs.sendMessage(tab.id, {
      action: "highlightText",
      text: node.title,
      content: node.content.substring(0, 100) // First part of content for better matching
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log("Could not highlight section:", chrome.runtime.lastError.message);
      }
    });
    
    // Show feedback
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '🌟 Highlighted';
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
    
  } catch (error) {
    console.error("Error highlighting section:", error);
  }
}

// Hugging Face API function
async function summarizeText(text) {
  if (!text || text.trim().length < 50) {
    return "متن کوتاه است و نیاز به خلاصه‌سازی ندارد.";
  }
  
  // Clean and prepare text
  const cleanText = text.replace(/\s+/g, ' ').trim();
  const textLength = cleanText.length;
  
  // Use different models based on text characteristics
  let apiUrl = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn";
  
  // For shorter texts or if BART fails, try alternative model
  if (textLength < 500) {
    apiUrl = "https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6";
  }
  
  const headers = {
    "Content-Type": "application/json"
  };
  
  if (huggingfaceApiKey) {
    headers["Authorization"] = "Bearer " + huggingfaceApiKey;
  }
  
  // Try primary summarization
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ 
        inputs: cleanText.substring(0, 1024), // Ensure text length is manageable
        parameters: {
          max_length: Math.min(150, Math.floor(textLength / 4)),
          min_length: Math.min(30, Math.floor(textLength / 10)),
          do_sample: false,
          temperature: 0.3
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result && result[0] && result[0].summary_text) {
        return result[0].summary_text;
      }
    }
    
    // If API returns error, try alternative approach
    console.log("Primary API failed, trying alternative...");
    
  } catch (error) {
    console.log("API Error:", error.message);
  }
  
  // Fallback: Try alternative model
  try {
    const alternativeUrl = "https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6";
    const response = await fetch(alternativeUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ 
        inputs: cleanText.substring(0, 512),
        parameters: {
          max_length: 100,
          min_length: 20
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result && result[0] && result[0].summary_text) {
        return result[0].summary_text;
      }
    }
  } catch (error) {
    console.log("Alternative API also failed:", error.message);
  }
  
  // Final fallback: Extractive summarization
  return extractiveSummary(cleanText);
}

// Fallback extractive summarization
function extractiveSummary(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length <= 3) {
    return text.substring(0, 200) + "...";
  }
  
  // Score sentences based on length and position
  const scoredSentences = sentences.map((sentence, index) => {
    const words = sentence.trim().split(/\s+/).length;
    const positionScore = index < sentences.length / 3 ? 1.2 : 1.0; // Prefer early sentences
    const lengthScore = words > 5 && words < 30 ? 1.1 : 0.9; // Prefer medium-length sentences
    
    return {
      text: sentence.trim(),
      score: positionScore * lengthScore,
      index: index
    };
  });
  
  // Select top sentences
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(3, Math.ceil(sentences.length / 3)))
    .sort((a, b) => a.index - b.index); // Re-sort by original order
  
  return topSentences.map(s => s.text).join('. ') + '.';
}