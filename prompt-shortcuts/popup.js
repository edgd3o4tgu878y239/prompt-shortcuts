// popup.js - ショートカット管理ロジック
document.addEventListener('DOMContentLoaded', function() {
  // 初期化
  chrome.storage.sync.get(['trigger'], function(result) {
    document.getElementById('trigger').value = result.trigger || '///';
  });

  // 保存ボタン
  document.getElementById('save-trigger').addEventListener('click', function() {
    const trigger = document.getElementById('trigger').value.trim();
    if (trigger) {
      chrome.storage.sync.set({ trigger: trigger }, function() {
        updateTriggerDisplay(trigger);
        showMessage('トリガーを保存しました');
      });
    }
  });

  document.getElementById('add-btn').addEventListener('click', addOrUpdateShortcut);
  document.getElementById('export-btn').addEventListener('click', exportShortcuts);
  document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', importShortcuts);

  loadShortcuts();
  localStorage.removeItem('editingShortcutId');
});

function updateTriggerDisplay(trigger) {
  const elements = document.getElementsByClassName('shortcut-trigger');
  for (let i = 0; i < elements.length; i++) {
    elements[i].textContent = trigger;
  }
}

function loadShortcuts() {
  chrome.storage.sync.get(['shortcuts', 'trigger'], function(result) {
    const shortcuts = result.shortcuts || [];
    const trigger = result.trigger || '///';
    updateTriggerDisplay(trigger);
    
    const shortcutList = document.getElementById('shortcut-list');
    shortcutList.innerHTML = '';

    if (shortcuts.length === 0) {
      shortcutList.innerHTML = '<div style="text-align:center;padding:20px;color:#999;">ショートカットがありません</div>';
      return;
    }

    shortcuts.forEach(function(shortcut, index) {
      const item = document.createElement('div');
      item.className = 'shortcut-item';

      if (shortcut.category) {
        const cat = document.createElement('span');
        cat.className = 'shortcut-category-tag';
        cat.textContent = shortcut.category;
        item.appendChild(cat);
      }

      const name = document.createElement('div');
      name.className = 'shortcut-name';
      name.textContent = `${trigger}${shortcut.name}`;

      const prompt = document.createElement('div');
      prompt.className = 'shortcut-prompt';
      prompt.textContent = shortcut.prompt;

      const btns = document.createElement('div');
      btns.className = 'action-btns';
      
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-btn';
      editBtn.textContent = '編集';
      editBtn.onclick = () => editShortcut(index);

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '削除';
      delBtn.onclick = () => deleteShortcut(index);

      btns.appendChild(editBtn);
      btns.appendChild(delBtn);
      item.appendChild(name);
      item.appendChild(prompt);
      item.appendChild(btns);
      shortcutList.appendChild(item);
    });
  });
}

function addOrUpdateShortcut() {
  const nameInput = document.getElementById('shortcut-name');
  const promptInput = document.getElementById('prompt-text');
  const categoryInput = document.getElementById('shortcut-category');
  
  const name = nameInput.value.trim();
  const prompt = promptInput.value.trim();
  const category = categoryInput.value.trim();

  if (!name || !prompt) {
    showMessage('名前と内容を入力してください');
    return;
  }

  chrome.storage.sync.get(['shortcuts'], function(result) {
    let shortcuts = result.shortcuts || [];
    const editingId = localStorage.getItem('editingShortcutId');
    
    if (editingId !== null) {
      shortcuts[parseInt(editingId)] = { name, prompt, category };
      localStorage.removeItem('editingShortcutId');
      document.getElementById('add-btn').textContent = '追加 / 保存';
    } else {
      if (shortcuts.some(s => s.name === name)) {
        showMessage('既に存在する名前です');
        return;
      }
      shortcuts.push({ name, prompt, category });
    }

    chrome.storage.sync.set({ shortcuts }, function() {
      nameInput.value = '';
      promptInput.value = '';
      categoryInput.value = '';
      loadShortcuts();
      showMessage('保存しました');
    });
  });
}

function editShortcut(id) {
  chrome.storage.sync.get(['shortcuts'], function(result) {
    const s = result.shortcuts[id];
    document.getElementById('shortcut-name').value = s.name;
    document.getElementById('prompt-text').value = s.prompt;
    document.getElementById('shortcut-category').value = s.category || '';
    document.getElementById('add-btn').textContent = '更新する';
    localStorage.setItem('editingShortcutId', id);
  });
}

function deleteShortcut(id) {
  if (!confirm('削除しますか？')) return;
  chrome.storage.sync.get(['shortcuts'], function(result) {
    let shortcuts = result.shortcuts || [];
    shortcuts.splice(id, 1);
    chrome.storage.sync.set({ shortcuts }, () => {
      loadShortcuts();
      showMessage('削除しました');
    });
  });
}

function showMessage(msg) {
  const div = document.createElement('div');
  div.style = 'position:fixed;top:10px;left:50%;transform:translateX(-50%);background:#333;color:white;padding:8px 15px;border-radius:4px;z-index:9999;font-size:12px;';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2000);
}

function exportShortcuts() {
  chrome.storage.sync.get(['shortcuts', 'trigger'], function(result) {
    const data = JSON.stringify(result, null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importShortcuts(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (confirm('データを上書きしてインポートしますか？')) {
        chrome.storage.sync.set(data, () => {
          loadShortcuts();
          if (data.trigger) document.getElementById('trigger').value = data.trigger;
          showMessage('インポート完了');
        });
      }
    } catch (err) { alert('ファイル形式が正しくありません'); }
  };
  reader.readAsText(file);
}