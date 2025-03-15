/**
 * 画像SVG変換ツール - メインアプリケーションスクリプト
 * 
 * このスクリプトは画像をSVG形式に変換するWebアプリケーションのメイン機能を実装しています。
 * 
 * 主な機能：
 * - JPG、PNG、GIF、WebP画像ファイルのドラッグ＆ドロップおよびファイル選択によるアップロード
 * - 画像のSVG形式への変換処理（Potraceライブラリを使用）
 * - 高度な物体認識によるレイヤー分離
 * - 変換進捗の表示
 * - 元画像とSVG変換結果のプレビュー表示
 * - レイヤーごとの編集（色変更、表示/非表示）
 * - Photopea、Illustrator互換SVG出力
 * - 変換されたSVGファイルのダウンロード
 * - 変換パラメータのカスタマイズ
 * 
 * @version 4.0.0
 */

/**
 * 進捗状況を更新します
 * @param {string} stage - 現在の処理段階
 * @param {number} percent - 進捗率（0-100）
 */
function updateProgressUI(stage, percent) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  if (progressBar && progressText) {
    progressBar.style.width = percent + '%';
    progressText.textContent = `${stage}... ${Math.round(percent)}%`;
  }
}

/**
 * エラーメッセージを表示
 * @param {string} message - エラーメッセージ
 * @param {string} action - アクションボタンのテキスト（nullの場合はボタン非表示）
 * @param {Function} actionHandler - アクションボタンのクリックハンドラ（省略可）
 */
function showErrorMessage(message, action, actionHandler) {
  console.error('エラー:', message);
  
  // エラー表示エリアを取得または作成
  let errorContainer = document.getElementById('error-container');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'error-container';
    
    // エラーコンテナを適切な位置に挿入
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer && progressContainer.parentNode) {
      progressContainer.parentNode.insertBefore(errorContainer, progressContainer.nextSibling);
    } else {
      const container = document.querySelector('.container');
      if (container) {
        container.appendChild(errorContainer);
      } else {
        document.body.appendChild(errorContainer);
      }
    }
  }
  
  // エラーメッセージのHTML生成
  let errorHtml = `
    <div class="error-message fade-in">
      <div class="icon">⚠️</div>
      <span class="message">${message}</span>
  `;
  
  // 特定のエラーメッセージに対する詳細情報
  if (message.includes('svgCode is not defined')) {
    // svgCode is not definedエラーのための技術情報
    errorHtml += `
      <details class="tech-info">
        <summary>技術的詳細（開発者向け）</summary>
        <div class="info-content">
          <p>このエラーは、SVGコードを表示するHTML要素を見つけられなかったか、SVGデータの処理中に問題が発生したことを示しています。</p>
          <p><strong>考えられる原因:</strong></p>
          <ul>
            <li>HTML内に<code>id="svg-code"</code>を持つ要素が存在しない</li>
            <li>SVGデータの変換が正常に完了していない</li>
            <li>JavaScript実行順序の問題</li>
          </ul>
          <p><strong>解決策:</strong></p>
          <ul>
            <li>ページを再読み込みして再試行する</li>
            <li>別の画像ファイルで試してみる</li>
            <li>ブラウザのキャッシュをクリアする</li>
          </ul>
        </div>
      </details>
    `;
  } else if (message.includes('Cannot read properties of undefined')) {
    // undefinedプロパティアクセスエラーのための技術情報
    errorHtml += `
      <details class="tech-info">
        <summary>技術的詳細（開発者向け）</summary>
        <div class="info-content">
          <p>このエラーは、存在しないオブジェクトのプロパティやメソッドにアクセスしようとしたことを示しています。</p>
          <p><strong>考えられる原因:</strong></p>
          <ul>
            <li>必要なJavaScriptモジュールが正しく読み込まれていない</li>
            <li>オブジェクトが初期化される前にアクセスされた</li>
            <li>既存の変数が上書きされた</li>
          </ul>
          <p><strong>解決策:</strong></p>
          <ul>
            <li>ページを再読み込みしてすべてのスクリプトが正しく読み込まれるようにする</li>
            <li>開発者ツールのコンソールで詳細なエラーを確認する</li>
            <li>ブラウザのキャッシュをクリアしてから再試行する</li>
          </ul>
        </div>
      </details>
    `;
  }
  
  // アクションボタンの追加（指定されている場合）
  if (action) {
    errorHtml += `<button class="action-button" id="error-action-button">${action}</button>`;
  }
  
  errorHtml += `</div>`;
  
  // エラーコンテナにHTML設定
  errorContainer.innerHTML = errorHtml;
  
  // アクションボタンのイベントハンドラを設定
  if (action) {
    const actionButton = document.getElementById('error-action-button');
    if (actionButton) {
      actionButton.onclick = function() {
        // カスタムハンドラが提供されている場合はそれを使用、そうでなければデフォルトアクション
        if (typeof actionHandler === 'function') {
          actionHandler();
        } else {
          // デフォルトアクション: エラーコンテナを非表示にしてUIをリセット
          errorContainer.innerHTML = '';
          resetUI();
        }
      };
    }
  }
  
  // ダウンロードボタンを無効化
  const downloadButton = document.getElementById('download-button');
  if (downloadButton) {
    downloadButton.disabled = true;
  }
}

/**
 * ファイルをSVGに変換します（安全なエラーハンドリング付き）
 * @param {File} file - 変換する画像ファイル
 * @param {Object} options - 変換オプション
 * @returns {Promise<string>} SVGデータを含むPromise
 */
function safeSvgConversion(file, options) {
  return new Promise((resolve, reject) => {
    try {
      console.log('safeSvgConversion: 変換開始', file.name, file.type);
      
      // ファイル形式チェック
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('無効なファイル形式です。画像ファイルを選択してください。'));
        return;
      }
      
      // 現在のファイルをグローバル変数に保存
      window.currentImageFile = file;
      
      // 進捗コールバック関数
      const progressCallback = function(stage, percent) {
        console.log(`進捗: ${stage} (${percent}%)`);
        updateProgressUI(stage, percent);
      };
      
      // 変換オプションを設定
      const conversionOptions = {
        // 画像処理オプション
        threshold: options.threshold || 128,
        colorMode: options.colorMode || 'color',
        colorQuantization: options.colorQuantization || 16,
        blurRadius: options.blurRadius || 0,
        simplify: options.simplify || 0.5,
        scale: options.scale || 1,
        strokeWidth: options.strokeWidth || 0,
        
        // レイヤーオプション
        enableLayers: options.enableLayers !== false,
        layerNaming: options.layerNaming || 'color',
        illustratorCompat: options.illustratorCompat !== false,
        photopeaCompat: options.photopeaCompat !== false,
        universalLayerCompat: true, // 汎用レイヤー互換モードを有効化
        
        // Photopea特有のオプション
        photopeaLayerPrefix: 'layer_', // レイヤー名のプレフィックス
        photopeaLayerNaming: 'color',  // レイヤー命名方法（'color', 'index', 'auto'）
        
        // 物体認識オプション
        objectDetection: options.objectDetection !== false,
        edgeThreshold: options.edgeThreshold || 30,
        minSegmentSize: options.minSegmentSize || 100,
        maxSegments: options.maxSegments || 24,
        
        // パフォーマンスオプション
        maxImageSize: options.maxImageSize || 2000,
        timeout: options.timeout || 60000,
        progressCallback: progressCallback,
        quality: options.quality || 0.8
      };
      
      console.log('変換オプション:', conversionOptions);
      
      // ImageTracerが利用可能かチェック
      if (typeof ImageTracer === 'undefined') {
        console.error('ImageTracerが見つかりません');
        useImageBasedFallback();
        return;
      }
      
      if (typeof ImageTracer.fileToSVG !== 'function') {
        console.error('ImageTracer.fileToSVG 関数が見つかりません');
        useImageBasedFallback();
        return;
      }
      
      // SVG変換を実行
      console.log('ImageTracer.fileToSVG 呼び出し');
      try {
        ImageTracer.fileToSVG(file, conversionOptions, handleSvgResult);
      } catch (error) {
        console.error('ImageTracer.fileToSVG 実行エラー:', error);
        useImageBasedFallback();
      }
      
      // SVG変換結果の処理
      function handleSvgResult(error, svgData) {
        if (error) {
          console.error('SVG変換エラー:', error);
          
          // エラーの詳細を確認
          const errorMessage = error.message || '不明なエラー';
          console.error('エラーメッセージ:', errorMessage);
          
          // 何らかのSVGデータが返された場合はそれを使用（フォールバック処理の結果）
          if (svgData && typeof svgData === 'string' && svgData.includes('<svg')) {
            console.log('フォールバックSVGを使用');
            resolve(svgData);
          } else {
            // フォールバック処理
            console.log('画像ベースのフォールバック処理を使用');
            useImageBasedFallback();
          }
        } else {
          // SVGデータの整合性チェック
          if (!svgData || typeof svgData !== 'string' || !svgData.includes('<svg')) {
            console.error('無効なSVGデータ:', svgData);
            useImageBasedFallback();
            return;
          }
          
          console.log('SVG変換完了:', svgData.substring(0, 100) + '...');
          resolve(svgData);
        }
      }
      
      // 画像ベースのフォールバック処理を実行
      function useImageBasedFallback() {
        console.log('画像ベースのフォールバック処理を開始');
        progressCallback('フォールバック処理中', 20);
        
        // 画像を読み込む
        const img = new Image();
        const objectURL = URL.createObjectURL(file);
        
        img.onload = function() {
          // 画像をリサイズしてキャンバスに描画
          progressCallback('画像リサイズ中', 40);
          
          try {
            const canvas = document.createElement('canvas');
            let width = img.naturalWidth;
            let height = img.naturalHeight;
            const maxSize = conversionOptions.maxImageSize || 2000;
            
            // リサイズが必要な場合
            if (width > maxSize || height > maxSize) {
              if (width > height) {
                height = Math.floor(height * (maxSize / width));
                width = maxSize;
              } else {
                width = Math.floor(width * (maxSize / height));
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Base64画像をSVGに埋め込む
            progressCallback('SVG生成中', 70);
            
            try {
              // カラーモードによって処理を分ける
              let svgData;
              
              if (conversionOptions.colorMode === 'bw') {
                // 白黒モード
                svgData = createBWFallbackSVG(canvas, conversionOptions.threshold);
              } else {
                // カラーモード - 単純に画像を埋め込む
                const dataURL = canvas.toDataURL('image/png', conversionOptions.quality);
                svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
                  <title>画像から変換 - フォールバック処理</title>
                  <image width="${width}" height="${height}" href="${dataURL}" />
                </svg>`;
              }
              
              // URLをクリーンアップ
              URL.revokeObjectURL(objectURL);
              
              progressCallback('完了', 100);
              resolve(svgData);
            } catch (svgError) {
              console.error('SVG生成エラー:', svgError);
              createErrorSVG(width, height, svgError.message);
            }
          } catch (canvasError) {
            console.error('キャンバス処理エラー:', canvasError);
            createErrorSVG(400, 300, canvasError.message);
          }
        };
        
        img.onerror = function() {
          console.error('画像読み込みエラー:', file.name);
          URL.revokeObjectURL(objectURL);
          createErrorSVG(400, 300, '画像の読み込みに失敗しました');
        };
        
        img.src = objectURL;
      }
      
      // 白黒モードのフォールバックSVG生成
      function createBWFallbackSVG(canvas, threshold) {
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        // 2値化処理
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // グレースケール変換
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          
          // 閾値で2値化
          const value = brightness >= threshold ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = value;
        }
        
        ctx.putImageData(imgData, 0, 0);
        
        // Base64画像をSVGに埋め込む
        const dataURL = canvas.toDataURL('image/png', 1.0);
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
          <title>白黒モード - フォールバック処理</title>
          <image width="${canvas.width}" height="${canvas.height}" href="${dataURL}" />
        </svg>`;
      }
      
      // エラーSVGの生成
      function createErrorSVG(width, height, message) {
        const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect width="100%" height="100%" fill="#f8f9fa" />
          <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#dc3545">エラー: ${message || '変換に失敗しました'}</text>
        </svg>`;
        
        resolve(svgData);
      }
    } catch (error) {
      console.error('予期せぬエラー:', error);
      
      try {
        // 最終手段のエラーSVG
        const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
          <rect width="100%" height="100%" fill="#f8f9fa" />
          <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#dc3545">致命的なエラー: ${error.message || '変換処理に失敗しました'}</text>
        </svg>`;
        
        resolve(svgData);
      } catch (finalError) {
        reject(error);
      }
    }
  });
}

// グローバル変数の初期化
let currentFile = null; // 現在選択されているファイル
let currentSvgData = null; // 現在のSVG変換結果
let currentLayers = []; // 現在のレイヤー情報
let fileInputClicked = false; // ファイル選択ボタンがクリックされたかのフラグ

// DOMが読み込まれたときの処理
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded - アプリケーション初期化');
  
  // HTML要素の参照を取得
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const originalImage = document.getElementById('original-image');
  const svgPreview = document.getElementById('svg-preview');
  const svgCode = document.getElementById('svg-code');
  const layersList = document.getElementById('layers-list');
  const layersContainer = document.getElementById('layers-container');
  const settingsContainer = document.getElementById('settings-container');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const resultContainer = document.getElementById('result-container');
  
  // 設定要素の参照取得
  const colorMode = document.getElementById('color-mode');
  const threshold = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  const colorQuantization = document.getElementById('color-quantization');
  const colorQuantizationValue = document.getElementById('color-quantization-value');
  const blurRadius = document.getElementById('blur-radius');
  const blurRadiusValue = document.getElementById('blur-radius-value');
  const simplify = document.getElementById('simplify');
  const simplifyValue = document.getElementById('simplify-value');
  const strokeWidth = document.getElementById('stroke-width');
  const strokeWidthValue = document.getElementById('stroke-width-value');
  const enableLayersCheckbox = document.getElementById('enable-layers');
  const illustratorCompatCheckbox = document.getElementById('illustrator-compat');
  const photopeaCompatCheckbox = document.getElementById('photopea-compat');
  const objectDetectionCheckbox = document.getElementById('object-detection');
  
  // ボタン要素の参照取得
  const convertButton = document.getElementById('convert-button');
  const downloadButton = document.getElementById('download-button');
  const resetButton = document.getElementById('reset-button');
  const showAllLayersButton = document.getElementById('show-all-layers');
  const hideAllLayersButton = document.getElementById('hide-all-layers');
  
  // 要素が存在するかチェック
  if (!uploadArea || !fileInput) {
    console.error('必要なDOM要素が見つかりません');
    return;
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
    
    // 現在のファイルを設定
    currentFile = file;
    // グローバル変数にも設定
    window.currentImageFile = file;
    
    console.log('ファイル処理開始:', file.name);
    console.log('ファイル形式:', file.type);
    
    // ファイル名を表示（アップロードエリアに）
    if (uploadArea) {
      uploadArea.innerHTML = `<p>${file.name}</p><p>${(file.size / 1024).toFixed(2)} KB</p>`;
    }
    
    // ファイルをURLに変換
    const objectURL = URL.createObjectURL(file);
    
    // プレビューコンテナを初期化
    if (originalImage) originalImage.src = '';
    if (svgPreview) svgPreview.innerHTML = '';
    if (svgCode) svgCode.textContent = '';
    
    // レイヤーリストを初期化
    if (layersList) {
      layersList.innerHTML = '';
    }
    
    // レイヤーコンテナを非表示にリセット
    if (layersContainer) {
      layersContainer.style.display = 'none';
    }
    
    // 設定コンテナを表示
    if (settingsContainer) {
      settingsContainer.style.display = 'block';
    }
    
    // 元画像プレビューを取得
    const originalPreview = document.getElementById('original-preview');
    
    // 画像の読み込み完了後に処理
    if (originalImage) {
      originalImage.onload = function() {
        console.log('画像読み込み完了:', file.name);
        
        // 結果コンテナを表示
        const resultContainer = document.getElementById('result-container');
        if (resultContainer) {
          resultContainer.style.display = 'block';
        }
        
        // 元のプレビューエリアを表示
        if (originalPreview) {
          originalPreview.style.display = 'block';
        }
        
        // SVGプレビューエリアの親要素を表示
        const previewItem = document.querySelector('.preview-item:nth-child(2)');
        if (previewItem) {
          previewItem.style.display = 'block';
        }
        
        // 変換ボタンを有効化
        if (convertButton) {
          convertButton.disabled = false;
        }
      };
      
      // 画像のロードエラー処理
      originalImage.onerror = function() {
        console.error('画像読み込みエラー:', file.name);
        alert('画像の読み込みに失敗しました');
        URL.revokeObjectURL(objectURL);
      };
      
      // 画像の読み込みを開始
      originalImage.src = objectURL;
    }
    
    // アップロードエリアに選択ボタンを再追加
    setTimeout(() => {
      // ボタンが既にない場合のみ追加
      if (uploadArea && !uploadArea.querySelector('.upload-button')) {
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
   * ドラッグオーバー時の処理
   * @param {DragEvent} event - ドラッグイベント
   */
  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    if (uploadArea) {
      uploadArea.classList.add('drag-over');
    }
  }
  
  /**
   * ドラッグが終了した時の処理
   * @param {DragEvent} event - ドラッグイベント
   */
  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    if (uploadArea) {
      uploadArea.classList.remove('drag-over');
    }
  }
  
  /**
   * ファイルがドロップされた時の処理
   * @param {DragEvent} event - ドロップイベント
   */
  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    if (uploadArea) {
      uploadArea.classList.remove('drag-over');
    }
    
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
    if (fileInput) {
      fileInput.value = '';
      
      // ダイアログを表示するためにクリックイベントを発生
      setTimeout(() => {
        fileInput.click();
      }, 50);
    }
  }
  
  /**
   * アップロードエリアのクリック処理
   * @param {Event} event - クリックイベント
   */
  function handleUploadAreaClick(event) {
    // "画像を選択"ボタンがクリックされた場合は専用ハンドラに任せる
    if (event.target.classList.contains('upload-button') || event.target.closest('.upload-button')) {
      return;
    }
    
    // それ以外の領域がクリックされた場合
    if (!fileInputClicked) {
      console.log('アップロードエリアクリック');
      handleFileButtonClick(event);
    }
  }
  
  // イベントリスナーの設定
  if (uploadArea) {
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', handleUploadAreaClick);
    
    // "画像を選択"ボタンに専用のイベントリスナーを追加
    const initialSelectButton = uploadArea.querySelector('.upload-button');
    if (initialSelectButton) {
      initialSelectButton.addEventListener('click', handleFileButtonClick);
    }
  }
  
  // ファイル選択イベント
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }
  
  // 変換ボタンのイベント
  if (convertButton) {
    convertButton.addEventListener('click', convertToSVG);
  }
  
  // ダウンロードボタンのイベント
  if (downloadButton) {
    downloadButton.addEventListener('click', downloadSVG);
  }
  
  // リセットボタンのイベント
  if (resetButton) {
    resetButton.addEventListener('click', resetUI);
  }
  
  // レイヤーボタンのイベント
  if (showAllLayersButton) {
    showAllLayersButton.addEventListener('click', showAllLayers);
  }
  
  if (hideAllLayersButton) {
    hideAllLayersButton.addEventListener('click', hideAllLayers);
  }
  
  // 設定値の変更イベントリスナー
  if (threshold) threshold.addEventListener('input', updateSettings);
  if (simplify) simplify.addEventListener('input', updateSettings);
  if (colorMode) colorMode.addEventListener('change', updateSettings);
  if (colorQuantization) colorQuantization.addEventListener('input', updateSettings);
  if (blurRadius) blurRadius.addEventListener('input', updateSettings);
  if (strokeWidth) strokeWidth.addEventListener('input', updateSettings);
  if (enableLayersCheckbox) enableLayersCheckbox.addEventListener('change', updateSettings);
  if (illustratorCompatCheckbox) illustratorCompatCheckbox.addEventListener('change', () => {
    console.log('イラストレーター互換モード:', illustratorCompatCheckbox.checked ? '有効' : '無効');
  });
  if (photopeaCompatCheckbox) photopeaCompatCheckbox.addEventListener('change', () => {
    console.log('Photopea互換モード:', photopeaCompatCheckbox.checked ? '有効' : '無効');
  });
  if (objectDetectionCheckbox) objectDetectionCheckbox.addEventListener('change', () => {
    console.log('物体認識:', objectDetectionCheckbox.checked ? '有効' : '無効');
  });
  
  // 初期設定値の表示
  updateSettings();
  console.log('アプリケーション初期化完了');
});

/**
 * 変換設定パラメータの更新
 */
function updateSettings() {
  thresholdValue.textContent = threshold.value;
  simplifyValue.textContent = simplify.value;
  
  // カラーモードによる閾値設定の表示/非表示
  const isBW = colorMode.value === 'bw';
  document.querySelector('.threshold-container').style.display = isBW ? 'block' : 'none';
  
  // 追加設定の更新
  if (colorQuantizationValue) {
    colorQuantizationValue.textContent = colorQuantization.value;
    // カラーモードの場合のみ色量子化設定を表示
    document.querySelector('.color-quantization-container').style.display = 
      colorMode.value === 'color' ? 'block' : 'none';
  }
  
  if (blurRadiusValue) {
    blurRadiusValue.textContent = blurRadius.value;
  }
  
  if (strokeWidthValue) {
    strokeWidthValue.textContent = strokeWidth.value;
    // 白黒モードの場合のみストローク幅設定を表示
    document.querySelector('.stroke-width-container').style.display = 
      colorMode.value === 'bw' ? 'block' : 'none';
  }
  
  // レイヤー設定の表示/非表示
  if (enableLayersCheckbox) {
    // レイヤー有効/無効の切り替え時に関連する設定を表示/非表示
    const layerOptionsContainer = document.querySelector('.layer-options-container');
    const aiCompatContainer = document.querySelector('.illustrator-compat-container');
    
    if (layerOptionsContainer) {
      layerOptionsContainer.style.display = enableLayersCheckbox.checked ? 'block' : 'none';
    }
    
    if (aiCompatContainer) {
      aiCompatContainer.style.display = enableLayersCheckbox.checked ? 'block' : 'none';
    }
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
  
  // SVGコード表示要素を取得
  const svgCode = document.getElementById('svg-code');
  if (!svgCode) {
    console.error('SVGコード表示要素(#svg-code)が見つかりません');
    return;
  }
  
  // SVGコードの表示（大きすぎる場合は一部だけ表示）
  if (svgData.length > 100000) {
    // 長すぎるSVGデータの場合は一部だけ表示
    const start = svgData.substring(0, 500);
    const end = svgData.substring(svgData.length - 500);
    svgCode.textContent = `${start}\n...(省略されました)...\n${end}`;
  } else {
    svgCode.textContent = svgData;
  }
  
  console.log('SVGコード表示を更新しました（文字数: ' + svgData.length + '）');
}

/**
 * SVGへの変換を実行します
 */
async function convertToSVG() {
  console.log('変換開始');
  
  try {
    // 現在の画像ファイルを取得
    const currentImageFile = window.currentImageFile || currentFile;
    if (!currentImageFile) {
      showErrorMessage('変換する画像ファイルが選択されていません', '画像を選択');
      return;
    }
    
    // ファイル情報のログ出力（デバッグ用）
    console.log('ファイル情報:', {
      name: currentImageFile.name,
      type: currentImageFile.type,
      size: currentImageFile.size,
      lastModified: new Date(currentImageFile.lastModified).toISOString()
    });
    
    // 進捗表示を初期化
    updateProgressUI('変換準備中', 0);
    const progressContainer = document.getElementById('progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }
    
    // 設定値を取得
    const colorModeEl = document.getElementById('color-mode');
    const thresholdEl = document.getElementById('threshold');
    const colorQuantizationEl = document.getElementById('color-quantization');
    const blurRadiusEl = document.getElementById('blur-radius');
    const simplifyEl = document.getElementById('simplify');
    const strokeWidthEl = document.getElementById('stroke-width');
    const enableLayersCheckboxEl = document.getElementById('enable-layers');
    const illustratorCompatCheckboxEl = document.getElementById('illustrator-compat');
    const photopeaCompatCheckboxEl = document.getElementById('photopea-compat');
    const objectDetectionCheckboxEl = document.getElementById('object-detection');
    
    // 変換オプションを設定
    const options = {
      // 画像処理オプション
      colorMode: colorModeEl ? colorModeEl.value : 'color',
      threshold: thresholdEl ? parseInt(thresholdEl.value) : 128,
      colorQuantization: colorQuantizationEl ? parseInt(colorQuantizationEl.value) : 16,
      blurRadius: blurRadiusEl ? parseInt(blurRadiusEl.value) : 0,
      simplify: simplifyEl ? parseFloat(simplifyEl.value) : 0.5,
      strokeWidth: strokeWidthEl ? parseFloat(strokeWidthEl.value) : 0,
      
      // レイヤーオプション
      enableLayers: enableLayersCheckboxEl ? enableLayersCheckboxEl.checked : true,
      layerNaming: 'color',
      illustratorCompat: illustratorCompatCheckboxEl ? illustratorCompatCheckboxEl.checked : true,
      photopeaCompat: photopeaCompatCheckboxEl ? photopeaCompatCheckboxEl.checked : true,
      universalLayerCompat: true, // 汎用レイヤー互換モードを常に有効化
      
      // Photopea特有のオプション
      photopeaLayerPrefix: 'layer_',
      photopeaLayerNaming: 'color',
      ensurePhotopeaCompat: true, // Photopeaとの互換性を確保する強制フラグ
      
      // 物体認識オプション
      objectDetection: objectDetectionCheckboxEl ? objectDetectionCheckboxEl.checked : true,
      
      // パフォーマンスオプション
      maxImageSize: 2000
    };
    
    // Photopea互換モードの設定を確認（デバッグ用）
    if (photopeaCompatCheckboxEl && photopeaCompatCheckboxEl.checked) {
      console.log('Photopea互換モードが有効化されています');
    } else {
      console.log('警告: Photopea互換モードが無効になっています。強制的に有効化します。');
      options.photopeaCompat = true;
    }
    
    try {
      // タイムアウト処理の設定（60秒）
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('変換処理がタイムアウトしました。画像サイズを小さくするか、別の画像をお試しください。')), 60000);
      });
      
      // SVGに変換（タイムアウト処理付き）
      const svgDataPromise = safeSvgConversion(currentImageFile, options);
      
      // race: 最初に完了した方のPromiseの結果を採用
      const svgData = await Promise.race([svgDataPromise, timeoutPromise]);
      
      // SVGデータがない場合はエラー
      if (!svgData) {
        throw new Error('SVGデータが生成されませんでした');
      }
      
      console.log('SVG変換成功: データサイズ', svgData.length, '文字');
      
      // SVGデータを保存
      window.currentSvgData = svgData;
      currentSvgData = svgData;
      
      // SVGプレビューを更新
      try {
        updateSvgPreview(svgData);
        console.log('SVGプレビュー更新完了');
      } catch (previewError) {
        console.error('SVGプレビュー更新エラー:', previewError);
        showErrorMessage('SVGプレビューの表示に失敗しました: ' + previewError.message, '再試行');
      }
      
      // SVGコード表示を更新
      try {
        updateSvgCodeDisplay(svgData);
        console.log('SVGコード表示更新完了');
      } catch (codeError) {
        console.error('SVGコード表示更新エラー:', codeError);
        // SVGコード表示の失敗はクリティカルではないので、エラーメッセージは表示せず続行
      }
      
      // レイヤー情報の抽出
      try {
        // ImageTracerとextractLayers関数が利用可能かチェック
        if (options.enableLayers && typeof ImageTracer !== 'undefined' && typeof ImageTracer.extractLayers === 'function') {
          console.log('レイヤー情報抽出開始');
          const layers = ImageTracer.extractLayers(svgData);
          
          // 有効なレイヤーがある場合のみ更新
          if (layers && layers.length > 0) {
            console.log('レイヤー検出:', layers.length, '個');
            currentLayers = layers;
            updateLayersList(layers);
          } else {
            console.log('レイヤーが検出されませんでした');
            // レイヤー情報がない場合はレイヤーコンテナを非表示
            const layersContainer = document.getElementById('layers-container');
            if (layersContainer) {
              layersContainer.style.display = 'none';
            }
          }
        } else {
          console.log('レイヤー抽出機能が利用できません');
        }
      } catch (layerError) {
        console.error('レイヤー情報の抽出に失敗しました:', layerError);
        // レイヤー抽出に失敗しても処理は継続
        const layersContainer = document.getElementById('layers-container');
        if (layersContainer) {
          layersContainer.style.display = 'none';
        }
      }
      
      // 進捗表示を完了状態に
      updateProgressUI('変換完了', 100);
      
      // 結果表示エリアを表示
      const resultContainer = document.getElementById('result-container');
      if (resultContainer) {
        resultContainer.style.display = 'block';
      }
      
      // ダウンロードボタンを有効化
      const downloadButton = document.getElementById('download-button');
      if (downloadButton) {
        downloadButton.disabled = false;
      }
    } catch (conversionError) {
      console.error('SVG変換実行エラー:', conversionError);
      
      // 特定のエラーメッセージに対する対応
      if (conversionError.message.includes('ImageTracerCore') || 
          conversionError.message.includes('getImageDataFromCanvas')) {
        showErrorMessage(
          'SVG変換に失敗しました: ' + conversionError.message,
          'ページを再読み込み',
          function() { window.location.reload(); }
        );
      } else {
        showErrorMessage(
          'SVG変換に失敗しました: ' + conversionError.message,
          '再試行'
        );
      }
      
      // 進捗表示をエラー状態に
      updateProgressUI('変換失敗', 0);
    }
  } catch (error) {
    console.error('予期せぬエラー:', error);
    showErrorMessage('予期せぬエラーが発生しました: ' + error.message, '再試行');
    
    // 進捗表示をエラー状態に
    updateProgressUI('エラー', 0);
  }
}

/**
 * SVGプレビューを更新します
 * @param {string} svgData - SVGデータ
 */
function updateSvgPreview(svgData) {
  const svgPreview = document.getElementById('svg-preview');
  
  // SVGデータの整合性チェック
  if (!svgData || !svgData.includes('<svg') || !svgData.includes('</svg>')) {
    showErrorMessage('不完全なSVGデータが生成されました', '別の画像や設定で再試行してください');
    return;
  }
  
  try {
    // プレビューを更新
    svgPreview.innerHTML = svgData;
    
    // 結果コンテナが表示されていることを確認
    const resultContainer = document.getElementById('result-container');
    if (resultContainer) {
      resultContainer.style.display = 'block';
    }
    
    // SVGプレビューの親要素が表示されていることを確認
    const previewParent = svgPreview.closest('.preview-item');
    if (previewParent) {
      previewParent.style.display = 'block';
    }
    
    // SVG要素にスタイルを適用
    const svgElement = svgPreview.querySelector('svg');
    if (svgElement) {
      // SVGの寸法を取得
      const width = svgElement.getAttribute('width') || svgElement.viewBox?.baseVal?.width || 100;
      const height = svgElement.getAttribute('height') || svgElement.viewBox?.baseVal?.height || 100;
      
      // viewBoxが設定されていない場合は設定
      if (!svgElement.getAttribute('viewBox')) {
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
      
      // アスペクト比を維持しながらプレビュー領域に収まるように調整
      svgElement.style.width = '100%';
      svgElement.style.height = 'auto';
      svgElement.style.maxHeight = '280px';
      svgElement.style.display = 'block';
      svgElement.style.margin = '0 auto';
      svgElement.style.objectFit = 'contain';
      
      // プリザベアスペクトレシオを設定
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      
      console.log(`SVGサイズ: ${width}x${height}, viewBox: ${svgElement.getAttribute('viewBox')}`);
    }
    
    // 現在のSVGデータを更新
    currentSvgData = svgData;
  } catch (error) {
    console.error('SVGプレビューの更新に失敗しました:', error);
    showErrorMessage('SVGプレビューの表示に失敗しました', null);
  }
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
  // 各要素の参照を取得
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const originalImage = document.getElementById('original-image');
  const svgPreview = document.getElementById('svg-preview');
  const svgCode = document.getElementById('svg-code');
  const previewContainer = document.getElementById('result-container');
  const settingsContainer = document.getElementById('settings-container');
  const progressContainer = document.getElementById('progress-container');
  const layersContainer = document.getElementById('layers-container');
  const layersList = document.getElementById('layers-list');
  const controlPanel = document.querySelector('.button-container');
  const downloadButton = document.getElementById('download-button');
  const colorMode = document.getElementById('color-mode');
  const threshold = document.getElementById('threshold');
  const thresholdValue = document.getElementById('threshold-value');
  const colorQuantization = document.getElementById('color-quantization');
  const colorQuantizationValue = document.getElementById('color-quantization-value');
  const blurRadius = document.getElementById('blur-radius');
  const blurRadiusValue = document.getElementById('blur-radius-value');
  const strokeWidth = document.getElementById('stroke-width');
  const strokeWidthValue = document.getElementById('stroke-width-value');
  const simplify = document.getElementById('simplify');
  const simplifyValue = document.getElementById('simplify-value');
  const enableLayersCheckbox = document.getElementById('enable-layers');
  const illustratorCompatCheckbox = document.getElementById('illustrator-compat');
  const photopeaCompatCheckbox = document.getElementById('photopea-compat');
  const objectDetectionCheckbox = document.getElementById('object-detection');

  // 各要素を初期状態に戻す
  if (uploadArea) {
    uploadArea.innerHTML = `
      <p>画像をここにドラッグ&ドロップ</p>
      <p>または</p>
      <label for="file-input" class="upload-button">画像を選択</label>
    `;
    
    // "画像を選択"ボタンにイベントリスナーを追加
    const selectButton = uploadArea.querySelector('.upload-button');
    if (selectButton) {
      selectButton.addEventListener('click', handleFileButtonClick);
    }
  }
  
  // 画像参照をクリア
  if (originalImage && originalImage.src && originalImage.src.startsWith('blob:')) {
    URL.revokeObjectURL(originalImage.src);
  }
  
  if (originalImage) originalImage.src = '';
  if (svgPreview) svgPreview.innerHTML = '';
  if (svgCode) svgCode.textContent = '';
  
  // レイヤーリストをクリア
  if (layersList) {
    layersList.innerHTML = '';
  }
  
  // 各コンテナの表示状態を設定
  if (layersContainer) {
    layersContainer.style.display = 'none';
  }
  
  if (previewContainer) {
    previewContainer.style.display = 'none';
  }
  
  if (settingsContainer) {
    settingsContainer.style.display = 'none';
  }
  
  if (progressContainer) {
    progressContainer.style.display = 'none';
  }
  
  if (controlPanel) {
    controlPanel.style.display = 'flex';
  }
  
  // 現在のファイルとSVGデータをクリア
  currentFile = null;
  currentSvgData = null;
  currentLayers = [];
  
  // ファイル入力をリセット
  if (fileInput) {
    fileInput.value = '';
  }
  
  // 状態フラグをリセット
  fileInputClicked = false;
  
  // 設定を初期値に戻す
  if (threshold) threshold.value = 128;
  if (colorMode) colorMode.value = 'color';
  if (simplify) simplify.value = 0.5;
  
  // 追加設定を初期値に戻す
  if (colorQuantization) colorQuantization.value = 16;
  if (colorQuantizationValue) {
    colorQuantizationValue.textContent = '16';
  }
  
  if (blurRadius) blurRadius.value = 0;
  if (blurRadiusValue) {
    blurRadiusValue.textContent = '0';
  }
  
  if (strokeWidth) strokeWidth.value = 0;
  if (strokeWidthValue) {
    strokeWidthValue.textContent = '0';
  }
  
  if (enableLayersCheckbox) {
    enableLayersCheckbox.checked = true;
  }
  
  if (illustratorCompatCheckbox) {
    illustratorCompatCheckbox.checked = true;
  }
  
  if (photopeaCompatCheckbox) {
    photopeaCompatCheckbox.checked = true;
  }
  
  if (objectDetectionCheckbox) {
    objectDetectionCheckbox.checked = true;
  }
  
  // ダウンロードボタンを無効化
  if (downloadButton) {
    downloadButton.disabled = true;
  }
  
  // 設定を更新
  updateSettings();
  
  console.log('UI リセット完了');
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

// resetUI関数をグローバルに公開
window.resetUI = resetUI; 