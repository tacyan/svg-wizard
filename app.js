/**
 * 画像SVG変換ツール - メインアプリケーションスクリプト
 * 
 * このスクリプトは画像をSVG形式に変換するWebアプリケーションのメイン機能を実装しています。
 * 
 * 主な機能：
 * - JPG、PNG、GIF、WebP画像ファイルのドラッグ＆ドロップおよびファイル選択によるアップロード
 * - 画像のSVG形式への変換処理（Potraceライブラリを使用）
 * - 変換進捗の表示
 * - 元画像とSVG変換結果のプレビュー表示
 * - レイヤーごとの編集（色変更、表示/非表示）
 * - 変換されたSVGファイルのダウンロード
 * - 変換パラメータのカスタマイズ
 * 
 * @version 3.0.0
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
  
  // レイヤーコンテナ要素を取得
  const layersContainer = document.getElementById('layers-container');
  const layersList = document.getElementById('layers-list');
  
  // 設定要素の取得
  const thresholdRange = document.getElementById('threshold-range');
  const thresholdValue = document.getElementById('threshold-value');
  const colorMode = document.getElementById('color-mode');
  const simplifyRange = document.getElementById('simplify-range');
  const simplifyValue = document.getElementById('simplify-value');
  
  // 追加設定要素の取得
  const colorQuantizationRange = document.getElementById('color-quantization-range');
  const colorQuantizationValue = document.getElementById('color-quantization-value');
  const blurRadiusRange = document.getElementById('blur-radius-range');
  const blurRadiusValue = document.getElementById('blur-radius-value');
  const strokeWidthRange = document.getElementById('stroke-width-range');
  const strokeWidthValue = document.getElementById('stroke-width-value');
  const enableLayersCheckbox = document.getElementById('enable-layers');
  
  // 現在のファイルとSVGデータの保存用変数
  let currentFile = null;
  let currentSvgData = null;
  let currentLayers = []; // レイヤー情報を保持
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
    console.log('ファイル形式:', file.type);
    
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
    
    // レイヤーリストを初期化
    if (layersList) {
      layersList.innerHTML = '';
    }
    // レイヤーコンテナを非表示にリセット
    if (layersContainer) {
      layersContainer.style.display = 'none';
    }
    
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
    
    // カラーモードによる閾値設定の表示/非表示
    const isBW = colorMode.value === 'bw';
    document.querySelector('.threshold-container').style.display = isBW ? 'block' : 'none';
    
    // 追加設定の更新
    if (colorQuantizationRange && colorQuantizationValue) {
      colorQuantizationValue.textContent = colorQuantizationRange.value;
      // カラーモードの場合のみ色量子化設定を表示
      document.querySelector('.color-quantization-container').style.display = 
        colorMode.value === 'color' ? 'block' : 'none';
    }
    
    if (blurRadiusRange && blurRadiusValue) {
      blurRadiusValue.textContent = blurRadiusRange.value;
    }
    
    if (strokeWidthRange && strokeWidthValue) {
      strokeWidthValue.textContent = strokeWidthRange.value;
      // 白黒モードの場合のみストローク幅設定を表示
      document.querySelector('.stroke-width-container').style.display = 
        colorMode.value === 'bw' ? 'block' : 'none';
    }
    
    // レイヤー設定の表示/非表示
    if (enableLayersCheckbox) {
      // レイヤー有効/無効の切り替え時に関連する設定を表示/非表示
      document.querySelector('.layer-options-container').style.display = 
        enableLayersCheckbox.checked ? 'block' : 'none';
    }
  }
  
  /**
   * レイヤーリストを更新する
   * @param {Array} layers - レイヤー情報の配列
   */
  function updateLayersList(layers) {
    // レイヤーコンテナがなければ処理しない
    if (!layersContainer || !layersList) return;
    
    // レイヤーが存在する場合はレイヤーコンテナを表示
    if (layers && layers.length > 0) {
      layersContainer.style.display = 'block';
      
      // レイヤーリストをクリア
      layersList.innerHTML = '';
      
      // レイヤー情報を保存
      currentLayers = layers;
      
      // レイヤーごとにリスト項目を作成
      layers.forEach(layer => {
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.dataset.layerId = layer.id;
        
        // 表示/非表示チェックボックス
        const visibilityCheckbox = document.createElement('input');
        visibilityCheckbox.type = 'checkbox';
        visibilityCheckbox.className = 'layer-visibility';
        visibilityCheckbox.checked = layer.visible;
        visibilityCheckbox.title = '表示/非表示';
        visibilityCheckbox.addEventListener('change', () => {
          toggleLayerVisibility(layer.id, visibilityCheckbox.checked);
        });
        
        // レイヤー名
        const layerName = document.createElement('span');
        layerName.className = 'layer-name';
        layerName.textContent = layer.name;
        
        // 色選択
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.className = 'layer-color-picker';
        colorPicker.value = layer.color;
        colorPicker.title = '色の変更';
        colorPicker.addEventListener('change', () => {
          changeLayerColor(layer.id, colorPicker.value);
        });
        
        // 要素を追加
        layerItem.appendChild(visibilityCheckbox);
        layerItem.appendChild(layerName);
        layerItem.appendChild(colorPicker);
        
        layersList.appendChild(layerItem);
      });
    } else {
      // レイヤーがない場合はコンテナを非表示
      layersContainer.style.display = 'none';
    }
  }
  
  /**
   * レイヤーの表示/非表示を切り替える
   * @param {String} layerId - レイヤーID
   * @param {Boolean} visible - 表示状態
   */
  function toggleLayerVisibility(layerId, visible) {
    if (!currentSvgData) return;
    
    try {
      // レイヤーの可視性を変更
      const updatedSvg = ImageTracer.setLayerVisibility(currentSvgData, layerId, visible);
      
      // SVG表示を更新
      svgPreview.innerHTML = updatedSvg;
      currentSvgData = updatedSvg;
      
      // SVGコードの表示を更新
      updateSvgCodeDisplay(updatedSvg);
      
      // レイヤー情報の更新
      const layerIndex = currentLayers.findIndex(layer => layer.id === layerId);
      if (layerIndex !== -1) {
        currentLayers[layerIndex].visible = visible;
      }
      
      console.log(`レイヤー "${layerId}" の表示状態を ${visible ? '表示' : '非表示'} に変更しました`);
    } catch (error) {
      console.error('レイヤー可視性変更エラー:', error);
      alert('レイヤーの表示状態の変更に失敗しました');
    }
  }
  
  /**
   * レイヤーの色を変更する
   * @param {String} layerId - レイヤーID
   * @param {String} newColor - 新しい色（16進数表記）
   */
  function changeLayerColor(layerId, newColor) {
    if (!currentSvgData) return;
    
    try {
      // レイヤーの色を変更
      const updatedSvg = ImageTracer.updateLayerColor(currentSvgData, layerId, newColor);
      
      // SVG表示を更新
      svgPreview.innerHTML = updatedSvg;
      currentSvgData = updatedSvg;
      
      // SVGコードの表示を更新
      updateSvgCodeDisplay(updatedSvg);
      
      // レイヤー情報の更新
      const layerIndex = currentLayers.findIndex(layer => layer.id === layerId);
      if (layerIndex !== -1) {
        currentLayers[layerIndex].color = newColor;
      }
      
      console.log(`レイヤー "${layerId}" の色を ${newColor} に変更しました`);
    } catch (error) {
      console.error('レイヤー色変更エラー:', error);
      alert('レイヤーの色変更に失敗しました');
    }
  }
  
  /**
   * SVGコード表示領域を更新する
   * @param {String} svgData - 更新するSVGデータ
   */
  function updateSvgCodeDisplay(svgData) {
    if (!svgData) return;
    
    // SVGコードの表示（大きすぎる場合は一部だけ表示）
    if (svgData.length > 100000) {
      // 長すぎるSVGデータの場合は一部だけ表示
      const start = svgData.substring(0, 500);
      const end = svgData.substring(svgData.length - 500);
      svgCode.textContent = `${start}\n...(省略されました)...\n${end}`;
    } else {
      svgCode.textContent = svgData;
    }
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
      scale: 1,
      maxImageSize: 2000 // 2000px以上の画像はリサイズ
    };
    
    // 追加オプションの設定
    if (colorQuantizationRange) {
      options.colorQuantization = parseInt(colorQuantizationRange.value);
    }
    
    if (blurRadiusRange) {
      options.blurRadius = parseFloat(blurRadiusRange.value);
    }
    
    if (strokeWidthRange && colorMode.value === 'bw') {
      options.strokeWidth = parseFloat(strokeWidthRange.value);
    }
    
    // レイヤー機能の有効/無効
    if (enableLayersCheckbox) {
      options.enableLayers = enableLayersCheckbox.checked;
    }
    
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
      const result = await ImageTracer.fileToSVG(
        currentFile,
        options,
        updateProgress
      );
      
      console.log('SVG変換完了:', currentFile.name);
      
      // レイヤー対応の結果形式かどうかをチェック
      if (result && typeof result === 'object' && result.svg) {
        // レイヤー対応のデータ形式
        currentSvgData = result.svg;
        
        // レイヤーリストを更新
        if (result.layers) {
          updateLayersList(result.layers);
        }
      } else {
        // 従来の文字列形式のSVGデータ
        currentSvgData = result;
        
        // SVGからレイヤー情報を抽出（可能な場合）
        try {
          const extractedLayers = ImageTracer.extractLayers(currentSvgData);
          if (extractedLayers.length > 0) {
            updateLayersList(extractedLayers);
          }
        } catch (e) {
          console.warn('レイヤー情報の抽出に失敗しました:', e);
        }
      }
      
      // SVG文字列の整合性チェック
      if (!currentSvgData || !currentSvgData.startsWith('<svg') || !currentSvgData.endsWith('</svg>')) {
        throw new Error('SVGデータの生成に失敗しました。不完全なSVGが生成されました。');
      }
      
      // SVGプレビューの表示
      svgPreview.innerHTML = currentSvgData;
      
      // SVGコードの表示を更新
      updateSvgCodeDisplay(currentSvgData);
      
      // ダウンロードボタンを有効化
      downloadBtn.disabled = false;
      downloadBtn.style.opacity = '1';
      
    } catch (error) {
      console.error('SVG変換エラー:', error);
      
      // エラーメッセージを表示
      svgPreview.innerHTML = `
        <div style="padding: 20px; background-color: #fff0f0; border: 1px solid #ffcccc; border-radius: 4px;">
          <h3 style="color: #cc0000;">変換エラー</h3>
          <p>${error.message || 'SVGへの変換中にエラーが発生しました。'}</p>
          <p>別の画像や設定で再試行してください。</p>
        </div>
      `;
      
      svgCode.textContent = `/* 変換エラー: ${error.message} */`;
      
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
    
    try {
      // SVG文字列の整合性を確認
      if (!currentSvgData.startsWith('<svg') || !currentSvgData.endsWith('</svg>')) {
        throw new Error('不完全なSVGデータです。再変換してください。');
      }
      
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
      
      console.log('SVGダウンロード完了:', filename);
    } catch (error) {
      console.error('ダウンロードエラー:', error);
      alert('ダウンロードに失敗しました: ' + error.message);
    }
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
    
    // レイヤーリストをクリア
    if (layersList) {
      layersList.innerHTML = '';
    }
    // レイヤーコンテナを非表示
    if (layersContainer) {
      layersContainer.style.display = 'none';
    }
    
    previewContainer.style.display = 'none';
    settingsContainer.style.display = 'none';
    progressContainer.style.display = 'none';
    controlPanel.style.display = 'none';
    
    // 現在のファイルとSVGデータをクリア
    currentFile = null;
    currentSvgData = null;
    currentLayers = [];
    
    // ファイル入力をリセット
    fileInput.value = '';
    
    // 状態フラグをリセット
    fileInputClicked = false;
    
    // 設定を初期値に戻す
    thresholdRange.value = 128;
    colorMode.value = 'color';
    simplifyRange.value = 0.5;
    
    // 追加設定を初期値に戻す
    if (colorQuantizationRange) {
      colorQuantizationRange.value = 16;
    }
    
    if (blurRadiusRange) {
      blurRadiusRange.value = 0;
    }
    
    if (strokeWidthRange) {
      strokeWidthRange.value = 0;
    }
    
    if (enableLayersCheckbox) {
      enableLayersCheckbox.checked = true;
    }
    
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
  
  /**
   * すべてのレイヤーを表示する
   */
  function showAllLayers() {
    if (!currentLayers || !currentLayers.length) return;
    
    currentLayers.forEach(layer => {
      // レイヤーの可視性をtrueに設定
      toggleLayerVisibility(layer.id, true);
      
      // チェックボックスの状態も更新
      const checkbox = document.querySelector(`.layer-item[data-layer-id="${layer.id}"] .layer-visibility`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }
  
  /**
   * すべてのレイヤーを非表示にする
   */
  function hideAllLayers() {
    if (!currentLayers || !currentLayers.length) return;
    
    currentLayers.forEach(layer => {
      // レイヤーの可視性をfalseに設定
      toggleLayerVisibility(layer.id, false);
      
      // チェックボックスの状態も更新
      const checkbox = document.querySelector(`.layer-item[data-layer-id="${layer.id}"] .layer-visibility`);
      if (checkbox) {
        checkbox.checked = false;
      }
    });
  }
  
  // 設定値の変更イベントリスナー
  thresholdRange.addEventListener('input', updateSettings);
  simplifyRange.addEventListener('input', updateSettings);
  colorMode.addEventListener('change', updateSettings);
  
  // 追加設定の変更イベントリスナー
  if (colorQuantizationRange) {
    colorQuantizationRange.addEventListener('input', updateSettings);
  }
  
  if (blurRadiusRange) {
    blurRadiusRange.addEventListener('input', updateSettings);
  }
  
  if (strokeWidthRange) {
    strokeWidthRange.addEventListener('input', updateSettings);
  }
  
  if (enableLayersCheckbox) {
    enableLayersCheckbox.addEventListener('change', updateSettings);
  }
  
  // レイヤー全体操作ボタンのイベントリスナー
  const showAllLayersBtn = document.getElementById('show-all-layers');
  if (showAllLayersBtn) {
    showAllLayersBtn.addEventListener('click', showAllLayers);
  }
  
  const hideAllLayersBtn = document.getElementById('hide-all-layers');
  if (hideAllLayersBtn) {
    hideAllLayersBtn.addEventListener('click', hideAllLayers);
  }
  
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