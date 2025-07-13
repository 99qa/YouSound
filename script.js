let player;
let isPlaying = false;
let volume = 100;
let isLooping = false;
let isShuffled = false;
let currentTime = 0;
let duration = 0;
let progressInterval;
let urlHistory = [];
let keepAliveInterval;
let heartbeatInterval;

// ローカルストレージから履歴を読み込み
function loadHistory() {
  const saved = localStorage.getItem('youSoundHistory');
  if (saved) {
    try {
      urlHistory = JSON.parse(saved);
    } catch (e) {
      urlHistory = [];
    }
  }
}

// 履歴をローカルストレージに保存
function saveHistory() {
  localStorage.setItem('youSoundHistory', JSON.stringify(urlHistory));
}

// 履歴にURLを追加
function addToHistory(url) {
  const existingIndex = urlHistory.findIndex(item => item.url === url);
  if (existingIndex !== -1) {
    urlHistory.splice(existingIndex, 1);
  }
  
  urlHistory.unshift({
    url: url,
    date: new Date().toLocaleString('ja-JP'),
    timestamp: Date.now()
  });
  
  // 最大20件まで保持
  if (urlHistory.length > 20) {
    urlHistory = urlHistory.slice(0, 20);
  }
  
  saveHistory();
  updateHistoryDisplay();
}

// 履歴から1つのアイテムを削除
function removeFromHistory(index) {
  urlHistory.splice(index, 1);
  saveHistory();
  updateHistoryDisplay();
  showNotification('履歴を削除しました', 'success');
}

// 履歴表示を更新
function updateHistoryDisplay() {
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = '';
  
  if (urlHistory.length === 0) {
    historyList.innerHTML = '<div class="history-item" style="text-align: center; opacity: 0.6;">履歴がありません</div>';
    return;
  }
  
  urlHistory.forEach((item, index) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.innerHTML = `
      <div class="history-content">
        <div class="history-url">${item.url}</div>
        <div class="history-date">${item.date}</div>
      </div>
      <button class="delete-history-item" data-index="${index}" title="削除">🗑️</button>
    `;
    
    // URLクリックで入力フィールドに設定
    historyItem.querySelector('.history-content').addEventListener('click', () => {
      document.getElementById('urlInput').value = item.url;
      hideHistoryDropdown();
    });
    
    // 削除ボタンのイベント
    historyItem.querySelector('.delete-history-item').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromHistory(index);
    });
    
    historyList.appendChild(historyItem);
  });
}

// 履歴ドロップダウンを表示
function showHistoryDropdown() {
  const dropdown = document.getElementById('historyDropdown');
  dropdown.classList.remove('hidden');
  updateHistoryDisplay();
}

// 履歴ドロップダウンを非表示
function hideHistoryDropdown() {
  const dropdown = document.getElementById('historyDropdown');
  dropdown.classList.add('hidden');
}

// 履歴をクリア
function clearHistory() {
  urlHistory = [];
  saveHistory();
  updateHistoryDisplay();
  showNotification('履歴をクリアしました', 'success');
}

// 時間をフォーマット
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// プログレスバーを更新
function updateProgress() {
  if (player && player.getCurrentTime && player.getDuration) {
    try {
      currentTime = player.getCurrentTime();
      duration = player.getDuration();
      
      if (duration > 0) {
        const progressPercent = (currentTime / duration) * 100;
        document.getElementById('progressFill').style.width = `${progressPercent}%`;
        document.getElementById('currentTime').textContent = formatTime(currentTime);
        document.getElementById('duration').textContent = formatTime(duration);
      }
    } catch (err) {
      // プレーヤーがまだ準備できていない場合は無視
    }
  }
}

// YouTube IFrame API の準備
function onYouTubeIframeAPIReady() {
  // プレーヤーは後で初期化されます
}

// URLからプレイリストIDを抽出
function extractPlaylistId(url) {
  try {
    const urlObj = new URL(url);
    const searchParams = new URLSearchParams(urlObj.search);
    
    // プレイリストID
    const playlistId = searchParams.get('list');
    if (playlistId) {
      return playlistId;
    }
    
    return null;
  } catch {
    // 正規表現でのフォールバック
    const playlistMatch = url.match(/[?&]list=([^#\&\?]+)/);
    if (playlistMatch) {
      return playlistMatch[1];
    }
    
    return null;
  }
}

// YouTubeのプレイリストURLを検証
function validateYouTubePlaylistUrl(url) {
  try {
    const urlObj = new URL(url);
    const isYouTube = urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com';
    const hasPlaylist = urlObj.searchParams.get('list');
    return isYouTube && hasPlaylist;
  } catch {
    return false;
  }
}

// プレーヤーの初期化
function initializePlayer(playlistId) {
  if (player) {
    player.destroy();
  }
  
  let playerVars = {
    autoplay: 1,
    controls: 0,
    modestbranding: 1,
    rel: 0,
    showinfo: 0,
    iv_load_policy: 3,
    cc_load_policy: 0,
    disablekb: 1,
    fs: 0,
    playsinline: 1,
    listType: 'playlist',
    list: playlistId
  };
  
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    playerVars: playerVars,
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError
    }
  });
}

// プレーヤーの準備完了時
function onPlayerReady(event) {
  event.target.setVolume(volume);
  if (isLooping) {
    event.target.setLoop(true);
  }
  if (isShuffled) {
    event.target.setShuffle(true);
  }
  updateSongInfo();
  
  // プログレス更新を開始
  progressInterval = setInterval(updateProgress, 1000);
  
  // 強力なキープアライブを開始
  startStrongKeepAlive();
}

// プレーヤーの状態変更時
function onPlayerStateChange(event) {
  isPlaying = event.data === YT.PlayerState.PLAYING;
  updatePlayPauseButton();
  updateSongInfo();
  
  if (isPlaying) {
    if (!progressInterval) {
      progressInterval = setInterval(updateProgress, 1000);
    }
    startStrongKeepAlive();
  } else {
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    if (event.data === YT.PlayerState.PAUSED) {
      stopStrongKeepAlive();
    }
  }
}

// 強力なキープアライブ機能（リセット完全防止）
function startStrongKeepAlive() {
  stopStrongKeepAlive(); // 既存のインターバルをクリア
  
  // 複数の方法でプレーヤーをアクティブに保つ
  keepAliveInterval = setInterval(() => {
    if (player && isPlaying) {
      try {
        // 方法1: 音量の微調整
        const currentVolume = player.getVolume();
        player.setVolume(currentVolume);
        
        // 方法2: プレーヤー状態の確認
        player.getPlayerState();
        
        // 方法3: 現在時間の取得
        player.getCurrentTime();
      } catch (err) {
        console.log('Keep alive failed:', err);
      }
    }
  }, 15000); // 15秒ごと
  
  // ハートビート機能（より頻繁な軽い操作）
  heartbeatInterval = setInterval(() => {
    if (player && isPlaying) {
      try {
        // 非常に軽い操作でプレーヤーをアクティブに保つ
        player.getPlaylist();
      } catch (err) {
        // エラーは無視
      }
    }
  }, 5000); // 5秒ごと
}

function stopStrongKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// エラー発生時
function onPlayerError(event) {
  let message = 'プレイリストの読み込みに失敗しました。';
  
  switch (event.data) {
    case 2:
      message = '無効なパラメータです。URLを確認してください。';
      break;
    case 5:
      message = 'HTML5プレーヤーでエラーが発生しました。';
      break;
    case 100:
      message = 'プレイリストが見つかりません。';
      break;
    case 101:
    case 150:
      message = 'プレイリストの所有者が埋め込みを許可していません。';
      break;
  }
  
  showNotification(message, 'error');
}

// 再生/一時停止ボタンの更新
function updatePlayPauseButton() {
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

// 曲情報の更新
function updateSongInfo() {
  if (player && player.getVideoData) {
    try {
      const data = player.getVideoData();
      if (data && data.title && data.author) {
        document.getElementById('songTitle').textContent = data.title;
        document.getElementById('channelTitle').textContent = data.author;
      }
    } catch (err) {
      console.error('動画データの取得に失敗:', err);
    }
  }
}

// 通知を表示
function showNotification(message, type = 'info') {
  // 既存の通知を削除
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(notification => notification.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // アニメーション用のクラスを追加
  setTimeout(() => notification.classList.add('show'), 100);

  // 3秒後に通知を削除
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

// フルスクリーン切り替え（埋め込み動画のフルスクリーン）
function toggleFullscreen() {
  if (player && player.getIframe) {
    try {
      const iframe = player.getIframe();
      
      if (!document.fullscreenElement) {
        iframe.requestFullscreen().then(() => {
          showNotification('フルスクリーンモード');
        }).catch(() => {
          showNotification('フルスクリーンに失敗しました', 'error');
        });
      } else {
        document.exitFullscreen().then(() => {
          showNotification('フルスクリーン終了');
        });
      }
    } catch (err) {
      showNotification('フルスクリーン機能が利用できません', 'error');
    }
  }
}

// 音量アイコンの更新
function updateVolumeIcon() {
  const volumeIcon = document.getElementById('volumeIcon');
  const volumeMutedIcon = document.getElementById('volumeMutedIcon');
  
  if (volume === 0) {
    volumeIcon.style.display = 'none';
    volumeMutedIcon.style.display = 'block';
  } else {
    volumeIcon.style.display = 'block';
    volumeMutedIcon.style.display = 'none';
  }
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  
  const urlForm = document.getElementById('urlForm');
  const urlInput = document.getElementById('urlInput');
  const playerContainer = document.getElementById('player-container');
  const volumeButton = document.getElementById('volumeButton');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeInput = volumeSlider.querySelector('input');
  const volumeDisplay = document.getElementById('volumeDisplay');
  const termsButton = document.getElementById('termsButton');
  const termsModal = document.getElementById('termsModal');
  const guideButton = document.getElementById('guideButton');
  const guideModal = document.getElementById('guideModal');
  const historyDropdown = document.getElementById('historyDropdown');
  const clearHistoryButton = document.getElementById('clearHistory');
  const progressBar = document.querySelector('.progress-bar');

  // URLフォームの送信
  urlForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    
    if (!url) {
      showNotification('URLを入力してください', 'error');
      return;
    }
    
    if (!validateYouTubePlaylistUrl(url)) {
      showNotification('YouTubeの有効なプレイリストURLを入力してください', 'error');
      return;
    }

    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
      showNotification('有効なプレイリストIDが見つかりませんでした', 'error');
      return;
    }

    playerContainer.classList.remove('hidden');
    initializePlayer(playlistId);
    addToHistory(url);
    hideHistoryDropdown();
    
    showNotification('プレイリストを読み込みました！', 'success');
  });

  // 入力フィールドのフォーカス時に履歴を表示
  urlInput.addEventListener('focus', () => {
    if (urlHistory.length > 0) {
      showHistoryDropdown();
    }
  });

  // 入力フィールドの入力時
  urlInput.addEventListener('input', (e) => {
    if (e.target.value.trim() === '' && urlHistory.length > 0) {
      showHistoryDropdown();
    } else {
      hideHistoryDropdown();
    }
  });

  // 履歴クリアボタン
  clearHistoryButton.addEventListener('click', clearHistory);

  // プログレスバークリック
  progressBar.addEventListener('click', (e) => {
    if (player && duration > 0) {
      const rect = progressBar.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const seekTime = duration * percentage;
      player.seekTo(seekTime);
      showNotification(`${formatTime(seekTime)}にシーク`);
    }
  });

  // 再生/一時停止
  document.getElementById('playPauseButton').addEventListener('click', () => {
    if (player) {
      if (isPlaying) {
        player.pauseVideo();
        showNotification('一時停止');
      } else {
        player.playVideo();
        showNotification('再生');
      }
    }
  });

  // 前の曲
  document.getElementById('prevButton').addEventListener('click', () => {
    if (player) {
      player.previousVideo();
      showNotification('前の曲を再生中');
    }
  });

  // 次の曲
  document.getElementById('nextButton').addEventListener('click', () => {
    if (player) {
      player.nextVideo();
      showNotification('次の曲を再生中');
    }
  });

  // 音量コントロール
  volumeButton.addEventListener('click', () => {
    volumeSlider.classList.toggle('hidden');
  });

  volumeInput.addEventListener('input', (e) => {
    volume = parseInt(e.target.value);
    if (player) {
      player.setVolume(volume);
    }
    volumeDisplay.textContent = `${volume}%`;
    updateVolumeIcon();
    showNotification(`音量: ${volume}%`);
  });

  // シャッフル
  document.getElementById('shuffleButton').addEventListener('click', () => {
    if (player) {
      isShuffled = !isShuffled;
      player.setShuffle(isShuffled);
      const button = document.getElementById('shuffleButton');
      button.classList.toggle('active', isShuffled);
      showNotification(isShuffled ? 'シャッフル: オン' : 'シャッフル: オフ');
    }
  });

  // リピート
  document.getElementById('loopButton').addEventListener('click', () => {
    if (player) {
      isLooping = !isLooping;
      player.setLoop(isLooping);
      const button = document.getElementById('loopButton');
      button.classList.toggle('active', isLooping);
      showNotification(isLooping ? 'リピート: オン' : 'リピート: オフ');
    }
  });

  // 共有
  document.getElementById('shareButton').addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'YouSound - YouTube Playlist Player',
          text: '素晴らしい音楽プレーヤーを見つけました！',
          url: window.location.href
        });
        showNotification('共有しました！', 'success');
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showNotification('URLをコピーしました！', 'success');
      }
    } catch (err) {
      showNotification('共有に失敗しました', 'error');
    }
  });

  // フルスクリーン
  document.getElementById('fullscreenButton').addEventListener('click', toggleFullscreen);

  // 利用規約モーダル
  termsButton.addEventListener('click', () => {
    termsModal.classList.remove('hidden');
  });

  // 使い方ガイドモーダル
  guideButton.addEventListener('click', () => {
    guideModal.classList.remove('hidden');
  });

  // モーダルを閉じる
  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      modal.classList.add('hidden');
    });
  });

  // モーダルの外側をクリックして閉じる
  [termsModal, guideModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });

  // 音量スライダーを非表示にする
  document.addEventListener('click', (e) => {
    if (!volumeSlider.contains(e.target) && !volumeButton.contains(e.target)) {
      volumeSlider.classList.add('hidden');
    }
    
    // 履歴ドロップダウンを非表示にする
    if (!historyDropdown.contains(e.target) && !urlInput.contains(e.target)) {
      hideHistoryDropdown();
    }
  });

  // キーボードショートカット
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        document.getElementById('playPauseButton').click();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        document.getElementById('prevButton').click();
        break;
      case 'ArrowRight':
        e.preventDefault();
        document.getElementById('nextButton').click();
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (volume < 100) {
          volumeInput.value = Math.min(100, volume + 10);
          volumeInput.dispatchEvent(new Event('input'));
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (volume > 0) {
          volumeInput.value = Math.max(0, volume - 10);
          volumeInput.dispatchEvent(new Event('input'));
        }
        break;
      case 'KeyS':
        e.preventDefault();
        document.getElementById('shuffleButton').click();
        break;
      case 'KeyL':
        e.preventDefault();
        document.getElementById('loopButton').click();
        break;
      case 'KeyF':
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  });

  // フルスクリーン変更イベント
  document.addEventListener('fullscreenchange', () => {
    const button = document.getElementById('fullscreenButton');
    if (document.fullscreenElement) {
      button.style.color = '#065fd4';
    } else {
      button.style.color = '';
    }
  });

  // 初期音量アイコン設定
  updateVolumeIcon();
});

// ページ離脱時にインターバルを停止
window.addEventListener('beforeunload', () => {
  if (progressInterval) {
    clearInterval(progressInterval);
  }
  stopStrongKeepAlive();
});

// ページの可視性変更時の処理（タブ切り替え対応）
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // タブが非アクティブになった時も強力なキープアライブを継続
    if (isPlaying) {
      startStrongKeepAlive();
    }
  }
});
