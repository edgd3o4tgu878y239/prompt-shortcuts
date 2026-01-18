// background.js - バックグラウンドスクリプト
chrome.runtime.onInstalled.addListener(function() {
  // デフォルトの設定を初期化
  chrome.storage.sync.get(['shortcuts', 'trigger'], function(result) {
    if (!result.shortcuts) {
      chrome.storage.sync.set({
        shortcuts: [
          { name: 'aisatsu', prompt: '親しい人にする挨拶を生成してください', category: '日常' },
          { name: 'thanks', prompt: 'お礼のメッセージを書いてください。感謝の気持ちを伝えたいです。', category: '日常' },
          { name: 'mtg-request', prompt: '打ち合わせの依頼メールのテンプレートを作成してください。', category: 'ビジネス' }
        ]
      });
    }
    
    if (!result.trigger) {
      chrome.storage.sync.set({ trigger: '///' });
    }
  });
});