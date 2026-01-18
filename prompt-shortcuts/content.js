// content.js - 階層カテゴリ対応版（バグ修正済み）
let trigger = '///';
let shortcuts = [];
let suggestionPopup = null;
let activeSuggestions = [];
let currentInputElement = null;
let selectedIndex = -1;
let lastTriggerIndex = -1;
let activeCategory = null; // 現在選択中のカテゴリ

function addStyles() {
  if (document.getElementById('prompt-shortcut-styles')) return;
  const style = document.createElement('style');
  style.id = 'prompt-shortcut-styles';
  style.textContent = `
    .ps-popup {
      position: absolute;
      background: white;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 220px;
      max-height: 280px;
      overflow-y: auto;
      z-index: 1000000;
      font-family: sans-serif;
      font-size: 14px;
      color: #333;
    }
    .ps-item {
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid #f0f0f0;
      user-select: none;
    }
    .ps-item:last-child { border-bottom: none; }
    .ps-item.selected, .ps-item:hover { background-color: #e8f0fe; }
    
    .ps-item-header { display: flex; align-items: center; gap: 6px; font-weight: bold; pointer-events: none; }
    .ps-item-cat-icon { color: #f4b400; font-size: 16px; }
    .ps-item-prompt-icon { color: #4285f4; font-size: 16px; }
    
    .ps-preview {
      font-size: 11px;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 3px;
      pointer-events: none;
    }
    .ps-no-res { padding: 15px; text-align: center; color: #999; font-style: italic; }
    .ps-back { background: #f8f9fa; color: #666; font-size: 12px; border-bottom: 2px solid #eee; }
  `;
  document.head.appendChild(style);
}

function loadSettings() {
  chrome.storage.sync.get(['shortcuts', 'trigger'], function(result) {
    shortcuts = result.shortcuts || [];
    trigger = result.trigger || '///';
  });
}

function initialize() {
  addStyles();
  loadSettings();
  chrome.storage.onChanged.addListener(loadSettings);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeyDown);
  
  // ポップアップ外クリックで閉じる処理
  document.addEventListener('click', (e) => {
    if (suggestionPopup && !suggestionPopup.contains(e.target)) {
      closePopup();
    }
  });
}

function handleInput(e) {
  if (!e.target.isContentEditable && !isInputElement(e.target)) return;
  currentInputElement = e.target;
  const value = getElementValue(currentInputElement);
  
  if (!trigger || value.indexOf(trigger) === -1) {
    closePopup();
    return;
  }

  lastTriggerIndex = value.lastIndexOf(trigger);
  const textAfterTrigger = value.substring(lastTriggerIndex + trigger.length);
  
  // 文字入力がある場合はカテゴリを無視して全件検索、空ならカテゴリ選択モード
  if (textAfterTrigger.length > 0) {
    activeCategory = null; 
    showSuggestions(textAfterTrigger);
  } else {
    showSuggestions("");
  }
}

function handleKeyDown(e) {
  if (!suggestionPopup) return;
  
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveSelection(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveSelection(-1);
  } else if (e.key === 'Enter') {
    if (selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(activeSuggestions[selectedIndex]);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closePopup();
  }
}

function showSuggestions(searchText) {
  let displayItems = [];

  if (searchText === "") {
    if (activeCategory) {
      displayItems.push({ name: "⬅️ 戻る", isBack: true });
      const filtered = shortcuts.filter(s => s.category === activeCategory);
      displayItems = [...displayItems, ...filtered];
    } else {
      const cats = [...new Set(shortcuts.map(s => s.category).filter(c => c))];
      displayItems = cats.map(c => ({ name: c, isCategory: true }));
      const noCat = shortcuts.filter(s => !s.category);
      displayItems = [...displayItems, ...noCat];
    }
  } else {
    displayItems = shortcuts.filter(s => s.name.toLowerCase().includes(searchText.toLowerCase()));
  }

  activeSuggestions = displayItems;
  renderPopup();
}

function renderPopup() {
  if (!suggestionPopup) {
    suggestionPopup = document.createElement('div');
    suggestionPopup.className = 'ps-popup';
    document.body.appendChild(suggestionPopup);
  }
  
  suggestionPopup.innerHTML = '';
  if (activeSuggestions.length === 0) {
    suggestionPopup.innerHTML = '<div class="ps-no-res">見つかりませんでした</div>';
  } else {
    activeSuggestions.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = `ps-item ${i === selectedIndex ? 'selected' : ''}`;
      if (item.isBack) div.classList.add('ps-back');
      
      const header = document.createElement('div');
      header.className = 'ps-item-header';
      
      let icon = '<span class="ps-item-prompt-icon">📄</span>';
      if (item.isCategory) icon = '<span class="ps-item-cat-icon">📁</span>';
      if (item.isBack) icon = '';

      header.innerHTML = `${icon} <span>${item.isCategory ? item.name : (item.isBack ? item.name : trigger + item.name)}</span>`;
      div.appendChild(header);

      if (item.prompt) {
        const preview = document.createElement('div');
        preview.className = 'ps-preview';
        preview.textContent = item.prompt;
        div.appendChild(preview);
      }

      // クリック時の伝播を防止しつつ処理を実行
      div.addEventListener('mousedown', (e) => {
        e.preventDefault(); // 入力欄のフォーカスを失わないようにする
      });

      div.addEventListener('click', (e) => {
        e.stopPropagation(); // documentのclickリスナーに伝わって閉じてしまうのを防ぐ
        handleSelect(item);
      });
      
      suggestionPopup.appendChild(div);
    });
  }

  positionPopup();
  selectedIndex = activeSuggestions.length > 0 ? 0 : -1;
  updateSelectionStyles();
}

function handleSelect(item) {
  if (item.isBack) {
    activeCategory = null;
    showSuggestions("");
  } else if (item.isCategory) {
    activeCategory = item.name;
    showSuggestions("");
  } else {
    applyPrompt(item.prompt);
  }
}

function applyPrompt(text) {
  if (!currentInputElement) return;
  const value = getElementValue(currentInputElement);
  
  const start = lastTriggerIndex;
  // 置換する長さを計算（現在のカーソル位置まで）
  let lengthToReplace = trigger.length;
  const textAfter = value.substring(lastTriggerIndex + trigger.length);
  
  // もし検索中の文字があればそれも含めて置換
  if (!activeCategory) {
    const match = textAfter.match(/^[^\s\n]*/);
    if (match) lengthToReplace += match[0].length;
  }

  replaceText(currentInputElement, start, lengthToReplace, text);
  closePopup();
}

function replaceText(el, start, len, text) {
  if (el.isContentEditable) {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
      const range = document.createRange();
      let textNode = findTextNodeAtPosition(el, start);
      if (textNode) {
        let nodeOffset = getTextNodeOffset(el, textNode);
        range.setStart(textNode, start - nodeOffset);
        range.setEnd(sel.anchorNode, sel.anchorOffset);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand('insertText', false, text);
      }
    }
  } else {
    const val = el.value;
    const before = val.substring(0, start);
    const after = val.substring(el.selectionEnd);
    el.value = before + text + after;
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
}

function moveSelection(dir) {
  if (activeSuggestions.length === 0) return;
  selectedIndex = (selectedIndex + dir + activeSuggestions.length) % activeSuggestions.length;
  updateSelectionStyles();
  suggestionPopup.querySelectorAll('.ps-item')[selectedIndex]?.scrollIntoView({ block: 'nearest' });
}

function updateSelectionStyles() {
  if (!suggestionPopup) return;
  suggestionPopup.querySelectorAll('.ps-item').forEach((el, i) => {
    el.classList.toggle('selected', i === selectedIndex);
  });
}

function positionPopup() {
  if (!suggestionPopup || !currentInputElement) return;
  let rect;
  if (currentInputElement.isContentEditable) {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) rect = sel.getRangeAt(0).getBoundingClientRect();
  }
  if (!rect) rect = currentInputElement.getBoundingClientRect();
  
  const top = window.scrollY + rect.bottom + 5;
  const left = window.scrollX + rect.left;
  
  suggestionPopup.style.top = top + 'px';
  suggestionPopup.style.left = left + 'px';
}

function closePopup() {
  if (suggestionPopup) { 
    suggestionPopup.remove(); 
    suggestionPopup = null; 
  }
  activeCategory = null;
  selectedIndex = -1;
}

function getElementValue(el) { return el.isContentEditable ? el.textContent : el.value; }
function isInputElement(el) { return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'; }
function findTextNodeAtPosition(el, offset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let cur = 0, node;
  while (node = walker.nextNode()) {
    cur += node.nodeValue.length;
    if (cur >= offset) return node;
  }
  return null;
}
function getTextNodeOffset(container, target) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let cur = 0, node;
  while (node = walker.nextNode()) {
    if (node === target) return cur;
    cur += node.nodeValue.length;
  }
  return 0;
}

initialize();