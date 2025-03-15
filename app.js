/**
 * 画像SVG変換ツール - メインアプリケーションスクリプト
 * 
 * このスクリプトは画像をSVG形式に変換するWebアプリケーションのメイン機能を実装しています。
 * 主な機能：
 * - 画像ファイルのドラッグ＆ドロップおよびファイル選択によるアップロード
 * - 画像のSVG形式への変換処理（Potraceライブラリを使用）
 * - 変換進捗の表示
 * - 元画像とSVG変換結果のプレビュー表示
 * - 変換されたSVGファイルのダウンロード
 * - 変換パラメータのカスタマイズ
 * 
 * 制限事項：
 * - 現在の実装では完全なベクター変換ではなく、画像をSVG内に埋め込む簡易的な方法を使用
 * - 大きなサイズの画像を処理する場合はブラウザのパフォーマンスに影響する可能性あり
 */

// DOMが読み込まれた後に実行
document.addEventListener('DOMContentLoaded', () => {
  // 要素の取得
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const uploadContainer = document.getElementById('upload-container');
  const settingsContainer = document.getElementById('settings-container');
  const previewContainer = document.getElementById('preview-container');
  const originalImage = document.getElementById('original-image');
  const svgPreview = document.getElementById('svg-preview');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const controlPanel = document.getElementById('control-panel');
  const convertBtn = document.getElementById('convert-btn');
  const downloadBtn = document.getElementById('download-btn');
  const resetBtn = document.getElementById('reset-btn');
  const svgCode = document.getElementById('svg-code');
  
  // 設定要素の取得
  const thresholdRange = document.getElementById('threshold-range');
  const thresholdValue = document.getElementById('threshold-value');
  const colorMode = document.getElementById('color-mode');
  const simplifyRange = document.getElementById('simplify-range');
  const simplifyValue = document.getElementById('simplify-value');
  
  // 現在のファイルとSVGデータの保存用変数
  let currentFile = null;
  let currentSvgData = null;
  let isConverting = false;
  // Windows環境でのファイル選択ダイアログの特殊な挙動に対応するため、状態管理を改善
  let fileInputClicked = false;
  
  /**
   * ファイルがドラッグされた時の処理
   * @param {DragEvent} event - ドラッグイベント
   */
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    uploadArea.classList.add('drag-over');
  }
  
  /**
   * ドラッグが終了した時の処理
   * @param {DragEvent} event - ドラッグイベント
   */
  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    uploadArea.classList.remove('drag-over');
  }
  
  /**
   * ファイルがドロップされた時の処理
   * @param {DragEvent} event - ドロップイベント
   */
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    uploadArea.classList.remove('drag-over');
    
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      handleFile(event.dataTransfer.files[0]);
    }
  }
  
  /**
   * ファイル選択ダイアログで選択された時の処理
   * @param {Event} event - ファイル選択イベント
   */
  function handleFileSelect(event) {
    console.log('ファイル選択イベント発生');
    
    // ファイルが選択されている場合のみ処理
    if (event.target.files && event.target.files.length > 0) {
      console.log('選択されたファイル:', event.target.files[0].name);
      handleFile(event.target.files[0]);
    }
    
    // 選択完了後にフラグをリセット（遅延させることでタイミング問題を回避）
    setTimeout(() => {
      fileInputClicked = false;
      console.log('ファイル選択状態をリセット');
    }, 300);
  }
  
  /**
   * ファイルの処理
   * @param {File} file - アップロードされたファイル
   */
  function handleFile(file) {
    // 画像ファイル以外は処理しない
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください');
      return;
    }
    
    currentFile = file;
    console.log('ファイル処理開始:', file.name);
    
    // ファイル名を表示
    uploadArea.innerHTML = `<p>${file.name}</p><p>${(file.size / 1024).toFixed(2)} KB</p>`;
    
    // ファイルをURLに変換
    const objectURL = URL.createObjectURL(file);
    
    // 読み込み中の表示
    const loadingIndicator = document.createElement('div');
    loadingIndicator.textContent = '画像読み込み中...';
    loadingIndicator.style.padding = '10px';
    loadingIndicator.style.textAlign = 'center';
    
    // プレビューコンテナを初期化して表示
    originalImage.src = '';
    svgPreview.innerHTML = '';
    svgCode.textContent = '';
    
    previewContainer.style.display = 'flex';
    
    // 読み込み中の表示をプレビューエリアに追加
    const imagePreview = document.querySelector('.image-preview');
    imagePreview.innerHTML = '';
    imagePreview.appendChild(loadingIndicator);
    
    // 画像の読み込み完了後に処理
    originalImage.onload = function() {
      console.log('画像読み込み完了:', file.name);
      // 読み込み完了後、読み込み中表示を削除して画像を表示
      imagePreview.innerHTML = '';
      imagePreview.appendChild(originalImage);
      
      // 設定パネルを表示
      settingsContainer.style.display = 'block';
      
      // コントロールパネルを表示（変換ボタンを有効に）
      controlPanel.style.display = 'flex';
      downloadBtn.disabled = true;
      downloadBtn.style.opacity = '0.5';
    };
    
    // 画像のロードエラー処理
    originalImage.onerror = function() {
      console.error('画像読み込みエラー:', file.name);
      alert('画像の読み込みに失敗しました');
      imagePreview.innerHTML = '<p>画像を読み込めませんでした</p>';
      URL.revokeObjectURL(objectURL);
    };
    
    // 画像の読み込みを開始
    originalImage.src = objectURL;
    
    // アップロードエリアに選択ボタンを再追加
    setTimeout(() => {
      // ボタンが既にない場合のみ追加
      if (!uploadArea.querySelector('.upload-button')) {
        const uploadButton = document.createElement('label');
        uploadButton.setAttribute('for', 'file-input');
        uploadButton.className = 'upload-button';
        uploadButton.textContent = '別の画像を選択';
        uploadButton.addEventListener('click', handleFileButtonClick);
        uploadArea.appendChild(uploadButton);
      }
    }, 500);
  }
  
  /**
   * 変換設定パラメータの更新
   */
  function updateSettings() {
    thresholdValue.textContent = thresholdRange.value;
    simplifyValue.textContent = simplifyRange.value;
  }
  
  /**
   * 画像をSVGに変換する
   */
  async function convertToSVG() {
    if (!currentFile || isConverting) return;
    
    isConverting = true;
    console.log('SVG変換開始:', currentFile.name);
    
    // 変換オプション
    const options = {
      threshold: parseInt(thresholdRange.value),
      colorMode: colorMode.value,
      simplify: parseFloat(simplifyRange.value),
      scale: 1
    };
    
    // ダウンロードボタンを無効化
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = '0.5';
    
    // 変換ボタンを非活性化
    convertBtn.disabled = true;
    convertBtn.style.opacity = '0.5';
    
    // 進捗バーを表示
    progressContainer.style.display = 'block';
    updateProgress(0);
    
    try {
      // 変換処理の開始
      currentSvgData = await ImageTracer.fileToSVG(
        currentFile,
        options,
        updateProgress
      );
      
      console.log('SVG変換完了:', currentFile.name);
      
      // SVGプレビューの表示
      svgPreview.innerHTML = currentSvgData;
      
      // SVGコードの表示
      svgCode.textContent = currentSvgData;
      
      // ダウンロードボタンを有効化
      downloadBtn.disabled = false;
      downloadBtn.style.opacity = '1';
      
    } catch (error) {
      console.error('SVG変換エラー:', error);
      alert('変換に失敗しました: ' + error.message);
    } finally {
      // 進捗表示を非表示に
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 500);
      
      // 変換ボタンを活性化
      convertBtn.disabled = false;
      convertBtn.style.opacity = '1';
      
      isConverting = false;
    }
  }
  
  /**
   * 変換進捗の更新
   * @param {Number} percent - 進捗パーセント（0-100）
   */
  function updateProgress(percent) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `変換中... ${Math.round(percent)}%`;
  }
  
  /**
   * SVGデータをダウンロードする
   */
  function downloadSVG() {
    if (!currentSvgData || !currentFile) return;
    
    // .svgの拡張子を持つファイル名を作成
    const filename = currentFile.name.replace(/\.[^/.]+$/, '') + '.svg';
    
    // Blobオブジェクトの作成
    const blob = new Blob([currentSvgData], { type: 'image/svg+xml' });
    
    // ダウンロードリンクの作成
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    
    // リンクをクリックしてダウンロードを開始
    document.body.appendChild(link);
    link.click();
    
    // クリーンアップ
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
      document.body.removeChild(link);
    }, 100);
  }
  
  /**
   * UIをリセットする
   */
  function resetUI() {
    // 各要素を初期状態に戻す
    uploadArea.innerHTML = `
      <p>画像をここにドラッグ&ドロップ</p>
      <p>または</p>
      <label for="file-input" class="upload-button">画像を選択</label>
    `;
    
    // 「画像を選択」ボタンにイベントリスナーを追加
    const selectButton = uploadArea.querySelector('.upload-button');
    if (selectButton) {
      selectButton.addEventListener('click', handleFileButtonClick);
    }
    
    // 画像参照をクリア
    if (originalImage.src && originalImage.src.startsWith('blob:')) {
      URL.revokeObjectURL(originalImage.src);
    }
    originalImage.src = '';
    svgPreview.innerHTML = '';
    svgCode.textContent = '';
    
    previewContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    progressContainer.style.display = 'none';
    controlPanel.style.display = 'none';
    
    // 現在のファイルとSVGデータをクリア
    currentFile = null;
    currentSvgData = null;
    
    // ファイル入力をリセット
    fileInput.value = '';
    
    // 状態フラグをリセット
    fileInputClicked = false;
    
    // 設定を初期値に戻す
    thresholdRange.value = 128;
    colorMode.value = 'color';
    simplifyRange.value = 0.5;
    updateSettings();
    
    console.log('UI リセット完了');
  }
  
  /**
   * 画像選択ボタンをクリックする処理
   * @param {Event} event - クリックイベント
   */
  function handleFileButtonClick(event) {
    // イベントの伝播を停止
    event.preventDefault();
    event.stopPropagation();
    
    // 既にクリック処理中の場合は無視
    if (fileInputClicked) {
      console.log('既にファイル選択処理中です');
      return;
    }
    
    // フラグを設定
    fileInputClicked = true;
    console.log('ファイル選択ボタンクリック - 入力をクリアしてダイアログを表示');
    
    // ファイル入力フィールドをリセット
    fileInput.value = '';
    
    // ダイアログを表示するためにクリックイベントを発生
    setTimeout(() => {
      fileInput.click();
    }, 50);
  }
  
  /**
   * アップロードエリアのクリック処理
   * @param {Event} event - クリックイベント
   */
  function handleUploadAreaClick(event) {
    // 「画像を選択」ボタンがクリックされた場合は専用ハンドラに任せる
    if (event.target.classList.contains('upload-button') || event.target.closest('.upload-button')) {
      return;
    }
    
    // それ以外の領域がクリックされた場合
    if (!fileInputClicked) {
      console.log('アップロードエリアクリック');
      handleFileButtonClick(event);
    }
  }
  
  // 設定値の変更イベントリスナー
  thresholdRange.addEventListener('input', updateSettings);
  simplifyRange.addEventListener('input', updateSettings);
  
  // イベントリスナーの設定
  uploadArea.addEventListener('dragover', handleDragOver);
  uploadArea.addEventListener('dragleave', handleDragLeave);
  uploadArea.addEventListener('drop', handleDrop);
  uploadArea.addEventListener('click', handleUploadAreaClick);
  
  // ファイル選択イベント
  fileInput.addEventListener('change', handleFileSelect);
  
  // 他のボタンのイベント
  convertBtn.addEventListener('click', convertToSVG);
  downloadBtn.addEventListener('click', downloadSVG);
  resetBtn.addEventListener('click', resetUI);
  
  // 「画像を選択」ボタンに専用のイベントリスナーを追加
  const initialSelectButton = uploadArea.querySelector('.upload-button');
  if (initialSelectButton) {
    initialSelectButton.addEventListener('click', handleFileButtonClick);
  }
  
  // 初期設定値の表示
  updateSettings();
  console.log('アプリケーション初期化完了');
}); 