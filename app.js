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
 * 画像ファイルをSVGに安全に変換する関数
 * エラー処理と代替手段を提供
 * @param {File} file - 変換対象の画像ファイル
 * @param {Object} options - 変換オプション
 * @param {Function} progressCallback - 進捗コールバック
 * @param {Function} resolve - 成功時の解決関数
 * @param {Function} reject - 失敗時の拒否関数
 */
function safeSvgConversion(file, options, progressCallback, resolve, reject) {
  // 有効な画像タイプかチェック
  if (!file || !file.type.startsWith('image/')) {
    console.error('無効なファイルタイプ:', file ? file.type : 'ファイルなし');
    reject(new Error('有効な画像ファイルを選択してください'));
    return;
  }
  
  console.log('SVG変換を開始します:', file.name);
  
  // 現在の画像ファイルを保存
  currentImageFile = file;
  
  // 進捗コールバック関数
  const progress = function(value) {
    console.log(`変換進捗: ${value}%`);
    if (typeof progressCallback === 'function') {
      progressCallback(value);
    }
  };
  
  // 変換オプションの設定
  const conversionOptions = {
    // 基本イメージ処理オプション
    threshold: options.threshold || 128,
    colorMode: options.colorMode || 'color',
    colorQuantization: options.colorQuantization || 16,
    blurRadius: options.blurRadius || 0,
    
    // レイヤーオプション
    enableLayers: options.enableLayers !== false,
    layerNaming: options.layerNaming || 'color',
    preserveLayers: options.preserveLayers !== false,
    layerCompatibility: options.layerCompatibility || 'photoshop',
    
    // オブジェクト検出オプション
    edgeThreshold: options.edgeThreshold || 20,
    minColorArea: options.minColorArea || 10,
    detailBoost: options.detailBoost || false,
    
    // パフォーマンスオプション
    maxImageSize: options.maxImageSize || 2000,
    timeout: options.timeout || 60000, // デフォルト1分のタイムアウト
    
    // 進捗コールバック
    progressCallback: progress
  };
  
  // グローバル変数に保存して他の関数からアクセス可能に
  window.conversionOptions = conversionOptions;
  
  // SVGLayerAdapterを使用
  if (typeof SVGLayerAdapter !== 'undefined' && typeof SVGLayerAdapter.fileToSVG === 'function') {
    console.log('SVGLayerAdapterを使用してSVG変換を実行');
    
    // 全体のタイムアウト処理
    const timeoutId = setTimeout(() => {
      console.error('SVG変換がタイムアウトしました（' + (conversionOptions.timeout / 1000) + '秒）');
      if (typeof reject === 'function') {
        reject(new Error('SVG変換処理がタイムアウトしました。処理が複雑すぎるか、サイズが大きすぎる可能性があります。'));
      }
    }, conversionOptions.timeout);
    
    try {
      SVGLayerAdapter.fileToSVG(file, conversionOptions, function(error, svgData) {
        clearTimeout(timeoutId); // タイムアウトをクリア
        
        if (error || !svgData) {
          console.error('SVGLayerAdapter変換エラー:', error);
          // ImageTracerにフォールバック
          fallbackToImageTracer(file, conversionOptions, resolve, reject);
        } else {
          console.log('SVGLayerAdapter変換成功');
          
          // SVGデータの検証
          if (typeof svgData === 'string' && svgData.includes('<svg')) {
            try {
              // 成功時の処理を実行
              handleSuccessfulConversion(svgData);
            } catch (handlerError) {
              console.error('成功ハンドラでエラー:', handlerError);
              resolve(svgData); // エラーでも元のSVGデータを返す
            }
          } else {
            console.error('無効なSVGデータ形式', typeof svgData);
            fallbackToImageTracer(file, conversionOptions, resolve, reject);
          }
        }
      });
    } catch (adapterError) {
      clearTimeout(timeoutId); // タイムアウトをクリア
      console.error('SVGLayerAdapter例外:', adapterError);
      fallbackToImageTracer(file, conversionOptions, resolve, reject);
    }
  } else {
    console.log('SVGLayerAdapterが利用できないため、ImageTracerにフォールバック');
    fallbackToImageTracer(file, conversionOptions, resolve, reject);
  }
  
  // 成功時の共通処理
  function handleSuccessfulConversion(svgData) {
    // SVGデータの整合性チェック
    if (!svgData || svgData.indexOf('<svg') === -1) {
      console.error('無効なSVGデータ:', svgData);
      
      // SVGデータが無効な場合は、元の画像を読み込んでフォールバック処理を試みる
      try {
        const reader = new FileReader();
        reader.onload = function(e) {
          const img = new Image();
          img.onload = function() {
            console.log('元画像を使用したフォールバック処理を開始');
            useImageBasedFallback(file, options, resolve, reject, img);
          };
          img.onerror = function() {
            console.error('元画像の読み込みに失敗。標準フォールバックを使用');
            useImageBasedFallback(file, options, resolve, reject);
          };
          img.src = e.target.result;
        };
        reader.onerror = function() {
          console.error('ファイル読み込みエラー。標準フォールバックを使用');
          useImageBasedFallback(file, options, resolve, reject);
        };
        reader.readAsDataURL(file);
      } catch (e) {
        console.error('フォールバック処理中にエラー:', e);
        useImageBasedFallback(file, options, resolve, reject);
      }
      return;
    }
    
    clearTimeout(conversionTimeout);
    
    // レイヤーの存在確認
    const hasLayers = svgData.includes('<g') && (
      svgData.includes('id="layer') || 
      svgData.includes('data-name=') || 
      svgData.includes('class="layer')
    );
    
    console.log('SVG変換結果:', {
      size: svgData.length,
      hasLayers: hasLayers
    });
    
    // レイヤー構造が存在するか確認
    if (hasLayers && options.enableLayers !== false) {
      // SVGのレイヤー数を分析
      const layerCount = analyzeSvgLayers(svgData, "変換直後");
      console.log(`変換後のSVGレイヤー数: ${layerCount}`);
      
      // レイヤー数を確認し、多すぎる場合は強制的に制限
      if (layerCount > 30) {
        console.log('レイヤー数が多すぎるため、制限を適用します');
        const MAX_ALLOWED_LAYERS = 30;
        svgData = enforceLayerLimit(svgData, MAX_ALLOWED_LAYERS);
        
        // 制限適用後のレイヤー数を再確認
        const newLayerCount = analyzeSvgLayers(svgData, "レイヤー制限適用後");
        console.log(`制限適用後のSVGレイヤー数: ${newLayerCount}`);
      }
      
      console.log('SVG変換完了:', svgData.substring(0, 100) + '...');
      resolve(svgData);
      return;
    }
    
    // --- 以下は既存の実装 ---

    // レイヤーが存在しない場合は、手動でレイヤー構造を追加
    if (options.enableLayers !== false) {
      try {
        console.log('SVGにレイヤーが見つかりません。レイヤー分割を試みます...');
        
        // SVGレイヤーを強制的に分割
        try {
          const forcedSvgData = forceSplitSvgLayers(svgData, true);
          if (forcedSvgData && forcedSvgData !== svgData) {
            // 分割後のレイヤー数をチェック
            const newLayerCount = (forcedSvgData.match(/<g[^>]*id="layer_/g) || []).length;
            console.log(`強制分割後のレイヤー数: ${newLayerCount}`);
            
            if (newLayerCount > 0) {
              console.log('強制レイヤー分割が成功しました');
              
              // レイヤー数を確認し、多すぎる場合は強制的に制限
              if (newLayerCount > 30) {
                console.log('レイヤー数が多すぎるため、制限を適用します');
                const limitedSvgData = enforceLayerLimit(forcedSvgData, 30);
                resolve(limitedSvgData);
                return;
              }
              
              resolve(forcedSvgData);
              return;
            }
          }
        } catch (splitError) {
          console.error('強制レイヤー分割エラー:', splitError);
          // エラー時も続行し、元のSVGを使用
        }
      } catch (layerError) {
        console.error('レイヤー処理中にエラーが発生しました:', layerError);
      }
    }
    
    // 問題なければそのまま元のSVGを返す
    console.log('SVG変換完了:', svgData.substring(0, 100) + '...');
    resolve(svgData);
  }
}

/**
 * SVGレイヤーを強制的に分割する
 * @param {string} svgData - SVGデータ
 * @param {Object} options - オプション
 * @returns {string} - 処理済みSVGデータ
 */
function forceSplitSvgLayers(svgData, options = {}) {
  console.log('SVGレイヤー強制分割を開始します...');
  
  if (!svgData || !svgData.includes('<svg')) {
    console.error('forceSplitSvgLayersに無効なSVGデータが渡されました');
    return svgData;
  }
  
  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
    
    // parsererror要素がある場合、XML解析エラーがあります
    const parseError = svgDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      console.error('SVGデータの解析中にエラーが発生しました');
      return svgData; // 元のデータを返す
    }
    
    const svgRoot = svgDoc.querySelector('svg');
    if (!svgRoot) {
      console.error('SVG要素が見つかりませんでした');
      return svgData;
    }
    
    // 既存のレイヤー数を確認
    const existingLayerCount = analyzeSvgLayers(svgData, "forceSplitSvgLayers開始時");
    console.log(`レイヤー分割前のSVG要素数: ${existingLayerCount}`);
    
    // オプションから最小と最大のレイヤー数を取得
    const minLayers = options.minLayers || 2;
    const maxLayers = options.maxLayers || 30;
    
    // SVG要素からすべてのパスとシェイプを取得
    const elements = [
      ...Array.from(svgRoot.querySelectorAll('path')),
      ...Array.from(svgRoot.querySelectorAll('polygon')),
      ...Array.from(svgRoot.querySelectorAll('rect')),
      ...Array.from(svgRoot.querySelectorAll('circle'))
    ];
    
    // 要素が見つからない場合は元のSVGを返す
    if (elements.length === 0) {
      console.log('分割可能な要素が見つかりませんでした');
      return svgData;
    }
    
    console.log(`分割対象の要素数: ${elements.length}`);
    
    // 要素ごとの色情報を抽出
    const elementColors = elements.map(element => {
      const fill = element.getAttribute('fill') || 'none';
      const stroke = element.getAttribute('stroke') || 'none';
      
      // fill:noneの場合はstrokeを優先
      const primaryColor = (fill === 'none') ? stroke : fill;
      
      return {
        element,
        primaryColor,
        secondaryColor: (fill === 'none') ? fill : stroke
      };
    });
    
    // 色の類似性に基づいて要素をグループ化
    const colorGroups = {};
    
    // 色の類似性を計算（HEXやRGBA形式を考慮）
    elementColors.forEach(item => {
      // 色の正規化
      const normalizedColor = normalizeColor(item.primaryColor);
      
      // グループにまだ存在しない場合は新しいグループを作成
      if (!colorGroups[normalizedColor]) {
        colorGroups[normalizedColor] = [];
      }
      
      // 要素をグループに追加
      colorGroups[normalizedColor].push(item.element);
    });
    
    // グループの数を確認
    let groupCount = Object.keys(colorGroups).length;
    console.log(`色に基づくグループ数: ${groupCount}`);
    
    // 類似色のマージ
    if (groupCount > maxLayers) {
      // 最終的なグループ数を制限するために色の類似性に基づいてマージ
      const mergedGroups = mergeColorGroups(colorGroups, maxLayers);
      groupCount = Object.keys(mergedGroups).length;
      console.log(`マージ後のグループ数: ${groupCount}`);
      
      // 元のグループを更新
      Object.assign(colorGroups, mergedGroups);
    } else if (groupCount < minLayers && Object.keys(colorGroups).length > 1) {
      // 少なすぎる場合は類似度の閾値を下げてより多くのグループに分割
      console.log(`グループ数が少なすぎます。より多くのグループに分割します...`);
      // この実装はより複雑になるため、現在のグループをそのまま使用
    }
    
    // 新しいSVG構造を作成
    const newSvgDoc = parser.parseFromString(svgData, 'image/svg+xml');
    const newSvgRoot = newSvgDoc.querySelector('svg');
    
    // 既存の内容をクリア（defsを保持）
    const defs = newSvgRoot.querySelector('defs');
    const defsClone = defs ? defs.cloneNode(true) : null;
    
    while (newSvgRoot.firstChild) {
      newSvgRoot.removeChild(newSvgRoot.firstChild);
    }
    
    // defsがあれば復元
    if (defsClone) {
      newSvgRoot.appendChild(defsClone);
    }
    
    // 各色グループをレイヤーとして追加
    Object.entries(colorGroups).forEach(([color, elements], index) => {
      if (elements.length === 0) return;
      
      // 新しいグループ要素を作成
      const group = newSvgDoc.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('id', `layer-${index + 1}`);
      
      // カラー名を取得して設定
      let colorName = getColorName(color);
      group.setAttribute('data-name', colorName || `レイヤー ${index + 1}`);
      
      // グループ内の要素を追加
      elements.forEach(element => {
        // 元の要素をクローン
        const elementClone = element.cloneNode(true);
        group.appendChild(elementClone);
      });
      
      newSvgRoot.appendChild(group);
    });
    
    // 新しいSVGデータを文字列に変換
    const serializer = new XMLSerializer();
    let newSvgData = serializer.serializeToString(newSvgDoc);
    
    // 最終的なレイヤー数を確認
    const finalLayerCount = analyzeSvgLayers(newSvgData, "forceSplitSvgLayers終了時");
    console.log(`レイヤー分割後の最終レイヤー数: ${finalLayerCount}`);
    
    // 最大レイヤー数を超えた場合は制限を適用
    if (finalLayerCount > maxLayers) {
      console.log(`最終レイヤー数(${finalLayerCount})が制限(${maxLayers})を超えています。制限を適用します。`);
      newSvgData = enforceLayerLimit(newSvgData, maxLayers);
    }
    
    return newSvgData;
  } catch (error) {
    console.error('SVGレイヤー分割中にエラーが発生しました:', error);
    return svgData; // エラーが発生した場合は元のデータを返す
  }
}

/**
 * 画像ベースのレイヤーSVGを生成する
 * @param {HTMLImageElement} imageElement - SVG内の画像要素
 * @param {string} width - 幅
 * @param {string} height - 高さ
 * @param {string} viewBox - ビューボックス
 * @returns {string} レイヤー分割されたSVG
 */
function createLayeredImageSVG(imageElement, width, height, viewBox) {
  // 画像のソース取得
  const imageHref = imageElement.getAttribute('href') || imageElement.getAttribute('xlink:href');
  if (!imageHref) return null;
  
  // 画像の大きさ取得
  const imgWidth = imageElement.getAttribute('width') || width;
  const imgHeight = imageElement.getAttribute('height') || height;
  
  // 基本レイヤーを持つSVG生成
  return `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
         viewBox="${viewBox || '0 0 ' + imgWidth + ' ' + imgHeight}" width="${imgWidth}" height="${imgHeight}">
      <defs>
        <clipPath id="svgFrame">
          <rect x="0" y="0" width="100%" height="100%" />
        </clipPath>
      </defs>
      <g id="Layers" data-photopea-root="true">
        <g id="layer_base" data-name="ベース画像" data-photopea-layer="true" clip-path="url(#svgFrame)">
          <image width="${imgWidth}" height="${imgHeight}" href="${imageHref}" />
        </g>
        <g id="layer_overlay" data-name="オーバーレイ" data-photopea-layer="true" opacity="0.5" clip-path="url(#svgFrame)" style="display:none">
          <rect width="${imgWidth}" height="${imgHeight}" fill="#ffffff" opacity="0.5" />
        </g>
      </g>
    </svg>
  `;
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
        // 既存のイベントリスナーを削除（念のため）
        uploadArea.removeEventListener('click', handleUploadAreaClick);
        
        // 新しいボタンを追加
        const uploadButton = document.createElement('label');
        uploadButton.setAttribute('for', 'file-input');
        uploadButton.className = 'upload-button';
        uploadButton.textContent = '別の画像を選択';
        
        // ボタンを追加
        uploadArea.appendChild(uploadButton);
        
        // アップロードエリアのクリックイベントを再設定
        uploadArea.addEventListener('click', handleUploadAreaClick);
      }
    }, 100); // タイミングを早めに
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
    
    // フラグをすぐにリセット
    fileInputClicked = false;
    
    // ファイルが選択されている場合のみ処理
    if (event.target.files && event.target.files.length > 0) {
      console.log('選択されたファイル:', event.target.files[0].name);
      handleFile(event.target.files[0]);
    } else {
      console.log('ファイルが選択されませんでした');
    }
  }
  
  /**
   * 画像選択ボタンをクリックする処理
   * @param {Event} event - クリックイベント
   */
  function handleFileButtonClick(event) {
    // イベントの伝播を停止
    event.preventDefault();
    event.stopPropagation();
    
    console.log('ファイル選択ボタンクリック - 入力をクリアしてダイアログを表示');
    
    // ファイル入力フィールドをリセット
    if (fileInput) {
      // 値をクリア
      fileInput.value = '';
      
      // フラグを設定（後で必ず解除されるように）
      fileInputClicked = true;
      
      try {
        // ダイアログを表示
        fileInput.click();
        
        // 念のため、タイムアウトでフラグをリセット
        setTimeout(() => {
          fileInputClicked = false;
          console.log('ファイル選択状態をリセット（タイムアウト）');
        }, 1000);
      } catch (e) {
        console.error('ファイル選択ダイアログの表示に失敗:', e);
        fileInputClicked = false;
      }
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
 * SVGへの変換処理を実行する関数
 * @param {File} file - 変換対象のファイルオブジェクト
 * @param {Object} options - 変換オプション
 * @param {Function} progressCallback - 進捗通知用コールバック関数
 * @returns {Promise<string>} SVGデータを含むPromiseオブジェクト
 */
function processSVGConversion(file, options, progressCallback) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('ファイルが指定されていません'));
      return;
    }

    console.log('SVG変換プロセスを開始します:', file.name);
    
    try {
      // 既存のsafeSvgConversion関数を呼び出す
      safeSvgConversion(file, options, progressCallback, resolve, reject);
    } catch (error) {
      console.error('SVG変換プロセス中にエラーが発生しました:', error);
      reject(error);
    }
  });
}

/**
 * SVGに変換ボタンのクリックハンドラー
 * ユーザーが選択したファイルをSVG形式に変換する
 */
function convertToSVG() {
  console.log('SVG変換を開始します');
  
  // ファイルが選択されているか確認
  if (!currentFile) {
    showErrorMessage('ファイルを選択してください', 'ファイルを選択', () => {
      document.getElementById('file-input').click();
    });
    return;
  }
  
  // ファイル情報をデバッグ出力
  console.log('変換対象ファイル:', currentFile.name, currentFile.type, currentFile.size);
  
  // 進捗表示の準備
  const progressContainer = document.getElementById('progress-container');
  if (progressContainer) {
    progressContainer.style.display = 'block';
  }
  updateProgressUI('SVGに変換中...', 0);
  
  // 変換設定を取得
  const colorMode = document.getElementById('color-mode').value;
  const threshold = parseInt(document.getElementById('threshold').value);
  const posterizeColors = parseInt(document.getElementById('color-quantization').value);
  const blurRadius = parseInt(document.getElementById('blur-radius').value);
  const edgeThreshold = 20; // デフォルト値を使用
  const enableLayers = document.getElementById('enable-layers').checked;
  const layerNaming = 'color'; // デフォルト値を使用
  const maxImageSize = 2000; // デフォルト値を使用
  const detailBoost = document.getElementById('object-detection').checked;
  
  // 変換オプションを設定
  const conversionOptions = {
    // 色モード設定
    colorMode: colorMode,
    threshold: threshold,
    colorQuantization: posterizeColors,
    blurRadius: blurRadius,
    edgeThreshold: edgeThreshold,
    detailBoost: detailBoost,
    
    // レイヤー関連設定
    enableLayers: enableLayers,
    layerNaming: layerNaming,
    enforceSingleLayer: !enableLayers,
    preserveLayers: enableLayers,
    layerCompatibility: 'photoshop',
    
    // オブジェクト検出と性能設定
    maxImageSize: maxImageSize,
    timeout: 120000, // 2分のタイムアウト
    
    // 進捗コールバック
    progressCallback: function(stage, progress) {
      // 進捗バーを更新
      updateProgressUI(stage, progress);
      console.log(`変換進捗: ${progress}%`);
    }
  };
  
  // SVG変換処理を実行
  processSVGConversion(currentFile, conversionOptions, updateProgressUI)
    .then(svgData => {
      // 成功時の処理
      console.log('SVG変換が成功しました');
      
      // 進捗表示を非表示
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      
      // SVGを表示
      updateSvgPreview(svgData);
      
      // SVGコードを表示エリアに設定
      updateSvgCodeDisplay(svgData);
      
      // 結果コンテナを表示
      const resultContainer = document.getElementById('result-container');
      if (resultContainer) {
        resultContainer.style.display = 'block';
      }
      
      // ダウンロードボタンを有効化
      const downloadButton = document.getElementById('download-button');
      if (downloadButton) {
        downloadButton.disabled = false;
      }
      
      // 現在のSVGデータを保存
      currentSvgData = svgData;
      
      // レイヤー情報を抽出して表示
      try {
        if (window.ImageTracer && typeof window.ImageTracer.extractLayers === 'function') {
          const layers = window.ImageTracer.extractLayers(svgData);
          updateLayersList(layers);
        }
      } catch (error) {
        console.error('レイヤー情報の抽出に失敗しました:', error);
      }
    })
    .catch(error => {
      // エラー時の処理
      console.error('SVG変換エラー:', error);
      
      // 進捗表示を非表示
      if (progressContainer) {
        progressContainer.style.display = 'none';
      }
      
      showErrorMessage('SVGへの変換中にエラーが発生しました: ' + error.message, 'リトライ', () => {
        convertToSVG();
      });
    });
}

/**
 * SVGプレビューを更新する
 * @param {string} svgData - SVGデータ文字列
 */
function updateSvgPreview(svgData) {
  if (!svgData) return;
  
  const svgPreview = document.getElementById('svg-preview');
  const svgCode = document.getElementById('svg-code');
  const layersList = document.getElementById('layers-list');
  const layersContainer = document.getElementById('layers-container');
  const downloadButton = document.getElementById('download-button');
  
  if (!svgPreview) return;
  
  // 最終的なレイヤー数確認と制限適用
  const MAX_LAYERS = 30;
  const layerCount = analyzeSvgLayers(svgData, "プレビュー表示前");
  console.log(`プレビュー表示前のSVGレイヤー数: ${layerCount}`);
  
  let finalSvgData = svgData;
  if (layerCount > MAX_LAYERS) {
    console.log(`最終出力でもレイヤー数(${layerCount})が多すぎるため、制限を適用します`);
    finalSvgData = enforceLayerLimit(svgData, MAX_LAYERS);
    
    // 制限適用後のレイヤー数を再確認
    const newLayerCount = analyzeSvgLayers(finalSvgData, "最終レイヤー制限適用後");
    console.log(`最終的なSVGレイヤー数: ${newLayerCount}`);
  }
  
  // 現在のSVGデータを更新
  currentSvgData = finalSvgData;
  
  // SVGプレビュー更新
  svgPreview.innerHTML = finalSvgData;
  
  // SVGコードを表示
  if (svgCode) {
    updateSvgCodeDisplay(finalSvgData);
  }
  
  // レイヤー情報を抽出・表示
  if (layersList && layersContainer) {
    try {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(finalSvgData, 'image/svg+xml');
      const layers = extractLayers(finalSvgData);
      
      if (layers && layers.length > 0) {
        updateLayersList(layers);
        layersContainer.style.display = 'block';
        
        // レイヤー数を表示
        const layersHeading = layersContainer.querySelector('h3');
        if (layersHeading) {
          layersHeading.textContent = `レイヤー管理 (${layers.length})`;
        }
      } else {
        layersContainer.style.display = 'none';
      }
    } catch (e) {
      console.error('レイヤー処理エラー:', e);
      layersContainer.style.display = 'none';
    }
  }
  
  // ダウンロードボタンを有効化
  if (downloadButton) {
    downloadButton.disabled = false;
  }
}

/**
 * SVGデータをダウンロードする
 */
function downloadSVG() {
  if (!currentSvgData || !currentFile) {
    showErrorMessage('ダウンロードできるSVGデータがありません。画像を選択して変換してください。', 'やり直す');
    return;
  }
  
  try {
    // SVG文字列の厳格な検証
    if (!currentSvgData.trim().startsWith('<?xml') && !currentSvgData.trim().startsWith('<svg')) {
      throw new Error('不完全なSVGデータです。再変換してください。');
    }
    
    // 必須SVG要素が含まれているか確認
    if (!currentSvgData.includes('<svg') || !currentSvgData.includes('</svg>')) {
      throw new Error('SVGの基本構造が不正です。再変換してください。');
    }
    
    // レイヤー情報を確認
    const layerCount = (currentSvgData.match(/<g[^>]*id="layer_/g) || []).length;
    console.log(`ダウンロードするSVGには ${layerCount} 個のレイヤーが含まれています`);
    
    if (layerCount === 0) {
      console.warn('レイヤーが検出されませんでした。レイヤー分割に問題がある可能性があります。');
    }
    
    // .svgの拡張子を持つファイル名を作成
    const filename = currentFile.name.replace(/\.[^/.]+$/, '') + '.svg';
    
    // Blobオブジェクトの作成
    const blob = new Blob([currentSvgData], { type: 'image/svg+xml' });
    
    // SVGデータサイズの確認
    const svgSizeInKB = Math.round(blob.size / 1024);
    console.log(`SVGデータサイズ: ${svgSizeInKB} KB`);
    
    // ファイルサイズの警告（オプション）
    if (svgSizeInKB > 5000) {
      console.warn(`SVGファイルサイズが大きいです (${svgSizeInKB} KB)。複雑すぎる可能性があります。`);
    }
    
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
    showErrorMessage('ダウンロードに失敗しました: ' + error.message, 'やり直す', function() {
      convertToSVG(); // エラーが発生した場合、自動的に再変換を試みる
    });
  }
}

/**
 * UIをリセットする
 */
function resetUI() {
  console.log('UIをリセットします');
  
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
  const controlPanel = document.querySelector('.control-panel');
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
    // イベントリスナーを一度削除してからHTMLを更新
    uploadArea.removeEventListener('dragover', handleDragOver);
    uploadArea.removeEventListener('dragleave', handleDragLeave);
    uploadArea.removeEventListener('drop', handleDrop);
    uploadArea.removeEventListener('click', handleUploadAreaClick);
    
    uploadArea.innerHTML = `
      <p>画像をここにドラッグ&ドロップ</p>
      <p>または</p>
      <label for="file-input" class="upload-button">画像を選択</label>
    `;
    
    // イベントリスナーを再設定
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', handleUploadAreaClick);
    
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
  
  // ダウンロードボタンを無効化
  if (downloadButton) {
    downloadButton.disabled = true;
  }
    
  // 現在のファイルとSVGデータをクリア
  currentFile = null;
  currentSvgData = null;
  currentLayers = [];
  window.currentImageFile = null;
    
  // ファイル入力をリセット
  if (fileInput) {
    // inputのvalueを空にした後、changeイベントが発火しないようにする
    fileInput.value = '';
  }
    
  // 状態フラグをリセット
  fileInputClicked = false;
    
  // 設定を初期値に戻す
  if (threshold) {
    threshold.value = 128;
    if (thresholdValue) thresholdValue.textContent = '128';
  }
  
  if (colorMode) colorMode.value = 'color';
  
  if (simplify) {
    simplify.value = 0.5;
    if (simplifyValue) simplifyValue.textContent = '0.5';
  }
  
  // 追加設定を初期値に戻す
  if (colorQuantization) {
    colorQuantization.value = 8;  // 16から8に変更
    if (colorQuantizationValue) colorQuantizationValue.textContent = '8';
  }
  
  if (blurRadius) {
    blurRadius.value = 0;
    if (blurRadiusValue) blurRadiusValue.textContent = '0';
  }
  
  if (strokeWidth) {
    strokeWidth.value = 0;
    if (strokeWidthValue) strokeWidthValue.textContent = '0';
  }
  
  if (enableLayersCheckbox) enableLayersCheckbox.checked = false;  // trueからfalseに変更
  if (illustratorCompatCheckbox) illustratorCompatCheckbox.checked = true;
  if (photopeaCompatCheckbox) photopeaCompatCheckbox.checked = true;
  if (objectDetectionCheckbox) objectDetectionCheckbox.checked = true;
  
  // エラーメッセージをクリア
  const errorContainer = document.querySelector('.error-message');
  if (errorContainer) {
    errorContainer.remove();
  }
  
  console.log('UIのリセットが完了しました');
  
  // 設定表示を更新
  updateSettings();
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

/**
 * ImageTracerを使用したフォールバック処理
 * SVGLayerAdapterが使用できない場合や失敗した場合に利用
 * @param {File} file - 変換対象のファイル
 * @param {Object} options - 変換オプション
 * @param {Function} resolve - 成功時の解決関数
 * @param {Function} reject - 失敗時の拒否関数
 */
function fallbackToImageTracer(file, options, resolve, reject) {
  console.log('ImageTracerにフォールバックします');
  
  // ImageTracerが利用可能か確認
  if (typeof ImageTracer === 'undefined') {
    console.error('ImageTracerが見つかりません');
    useImageBasedFallback(file, options, resolve, reject);
      return;
    }
    
  if (typeof ImageTracer.fileToSVG !== 'function') {
    console.error('ImageTracer.fileToSVG関数が見つかりません');
    useImageBasedFallback(file, options, resolve, reject);
    return;
  }
  
  // タイムアウト設定
  const timeoutId = setTimeout(() => {
    console.error('ImageTracer変換がタイムアウトしました');
    useImageBasedFallback(file, options, resolve, reject);
  }, options.timeout || 30000);
  
  // ImageTracerで変換を実行
  try {
    console.log('ImageTracerでSVG変換を実行');
    ImageTracer.fileToSVG(file, options, function(error, svgData) {
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('ImageTracer変換エラー:', error);
        useImageBasedFallback(file, options, resolve, reject);
      } else if (!svgData || typeof svgData !== 'string' || !svgData.includes('<svg')) {
        console.error('ImageTracerから無効なSVGデータが返されました');
        useImageBasedFallback(file, options, resolve, reject);
      } else {
        console.log('ImageTracer変換成功');
        
        try {
          // 成功時の処理を実行
          handleSuccessfulConversion(svgData);
        } catch (handlerError) {
          console.error('成功ハンドラでエラー:', handlerError);
          resolve(svgData); // エラーでも元のSVGデータを返す
        }
      }
    });
  } catch (tracerError) {
    clearTimeout(timeoutId);
    console.error('ImageTracer実行エラー:', tracerError);
    useImageBasedFallback(file, options, resolve, reject);
  }
}

/**
 * 画像ベースのフォールバック処理
 * すべてのSVG変換方法が失敗した場合の最終手段
 * @param {File} file - 変換対象のファイル
 * @param {Object} options - 変換オプション
 * @param {Function} resolve - 成功時の解決関数
 * @param {Function} reject - 失敗時の拒否関数
 * @param {Image} [originalImage] - 既に読み込まれた画像（オプション）
 */
function useImageBasedFallback(file, options, resolve, reject, originalImage = null) {
  console.log('画像ベースのフォールバック処理を開始');
  
  // 既に読み込まれた画像がある場合はそれを使用
  if (originalImage instanceof HTMLImageElement && originalImage.complete) {
    try {
      processOriginalImage(originalImage);
      return;
    } catch (err) {
      console.error('既存画像の処理に失敗:', err);
      // 失敗時は通常の画像読み込みフローにフォールバック
    }
  }
  
  try {
    const img = new Image();
    const objectURL = URL.createObjectURL(file);
    
    // タイムアウト設定
    const timeoutId = setTimeout(() => {
      console.error('画像読み込みがタイムアウトしました');
      URL.revokeObjectURL(objectURL);
      createErrorSVG('画像の読み込みタイムアウト', resolve);
    }, 10000);
    
    img.onload = function() {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(objectURL);
      processOriginalImage(img);
    };
    
    img.onerror = function(error) {
      clearTimeout(timeoutId);
      console.error('画像読み込みエラー:', error);
      URL.revokeObjectURL(objectURL);
      
      try {
        // フォールバックとしてFileReaderを使用して読み込みを試みる
        const reader = new FileReader();
        
        reader.onload = function(e) {
          try {
            // Base64データURLから仮の画像要素を作成
            const tempImg = new Image();
            tempImg.src = e.target.result;
            tempImg.onload = function() {
              // 読み込み成功時、画像要素をエラーSVGに渡す
              createErrorSVG('SVG変換に失敗しましたが、元画像を表示します', resolve, tempImg);
            };
            tempImg.onerror = function() {
              // この方法でも読み込みに失敗した場合
              createErrorSVG('画像の読み込みに失敗しました', resolve);
            };
          } catch (e) {
            createErrorSVG('画像の読み込みに失敗しました', resolve);
          }
        };
        
        reader.onerror = function() {
          createErrorSVG('画像の読み込みに失敗しました', resolve);
        };
        
        reader.readAsDataURL(file);
      } catch (e) {
        createErrorSVG('画像の読み込みに失敗しました', resolve);
      }
    };
    
    img.src = objectURL;
    
  } catch (error) {
    console.error('画像フォールバックエラー:', error);
    createErrorSVG(error.message, resolve);
  }
  
  // 画像処理の共通関数
  function processOriginalImage(image) {
    try {
      const canvas = document.createElement('canvas');
      const maxSize = options.maxImageSize || 2000;
      
      // 画像サイズが大きすぎる場合はリサイズ
      if (image.width > maxSize || image.height > maxSize) {
        const scale = Math.min(maxSize / image.width, maxSize / image.height);
        canvas.width = Math.floor(image.width * scale);
        canvas.height = Math.floor(image.height * scale);
      } else {
        canvas.width = image.width;
        canvas.height = image.height;
      }
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // カラーモードに応じた処理
      const isBW = options.colorMode === 'bw';
      
      let svg;
      if (isBW) {
        // 白黒モード：閾値でレイヤー分割
        svg = createBWFallbackSVG(canvas, options.threshold || 128);
      } else {
        // カラーモード：色の量子化でレイヤー分割
        svg = createColorLayeredSVG(canvas, options);
      }
      
      // SVGのレイヤー数を分析
      const layerCount = analyzeSvgLayers(svg, "フォールバック変換後");
      console.log(`フォールバック変換後のSVGレイヤー数: ${layerCount}`);
      
      // レイヤー数を制限
      if (layerCount > 30) {
        console.log('フォールバックでのレイヤー数が多すぎるため、制限を適用します');
        const MAX_ALLOWED_LAYERS = 30;
        svg = enforceLayerLimit(svg, MAX_ALLOWED_LAYERS);
        
        // 制限適用後のレイヤー数を再確認
        const newLayerCount = analyzeSvgLayers(svg, "フォールバックでのレイヤー制限適用後");
        console.log(`制限適用後のSVGレイヤー数: ${newLayerCount}`);
      }
      
      clearTimeout(timeoutId);
      console.log('画像ベースのフォールバック処理が完了しました');
      resolve(svg);
    } catch (e) {
      console.error('画像処理エラー:', e);
      clearTimeout(timeoutId);
      
      // エラー時は元画像をベースにしたSVGを生成
      try {
        const errorMessage = 'SVG変換エラー: ' + e.message;
        createErrorSVG(errorMessage, resolve, image);
      } catch (svgError) {
        reject(new Error('SVG生成に失敗しました: ' + e.message));
      }
    }
  }
}

/**
 * 白黒モードのフォールバックSVG生成
 * @param {HTMLCanvasElement} canvas - 処理対象のキャンバス
 * @param {number} threshold - 2値化の閾値 (0-255)
 * @returns {string} SVGデータ
 */
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
  
  // 黒と白のレイヤーに分ける
  const blackCanvas = document.createElement('canvas');
  const whiteCanvas = document.createElement('canvas');
  blackCanvas.width = whiteCanvas.width = canvas.width;
  blackCanvas.height = whiteCanvas.height = canvas.height;
  
  const blackCtx = blackCanvas.getContext('2d');
  const whiteCtx = whiteCanvas.getContext('2d');
  
  // 黒レイヤーの作成
  blackCtx.drawImage(canvas, 0, 0);
  const blackImgData = blackCtx.getImageData(0, 0, blackCanvas.width, blackCanvas.height);
  const blackData = blackImgData.data;
  
  // 白い部分を透明にする
  for (let i = 0; i < blackData.length; i += 4) {
    if (blackData[i] === 255) { // 白い部分
      blackData[i + 3] = 0; // アルファ値を0に
    }
  }
  
  blackCtx.putImageData(blackImgData, 0, 0);
  
  // 白レイヤーの作成
  whiteCtx.drawImage(canvas, 0, 0);
  const whiteImgData = whiteCtx.getImageData(0, 0, whiteCanvas.width, whiteCanvas.height);
  const whiteData = whiteImgData.data;
  
  // 黒い部分を透明にする
  for (let i = 0; i < whiteData.length; i += 4) {
    if (whiteData[i] === 0) { // 黒い部分
      whiteData[i + 3] = 0; // アルファ値を0に
    }
  }
  
  whiteCtx.putImageData(whiteImgData, 0, 0);
  
  // レイヤー分割されたSVGを生成
  const whiteDataURL = whiteCanvas.toDataURL('image/png');
  const blackDataURL = blackCanvas.toDataURL('image/png');
  
  return `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
         width="${canvas.width}" height="${canvas.height}" 
         viewBox="0 0 ${canvas.width} ${canvas.height}">
      <defs>
        <clipPath id="svgFrame">
          <rect x="0" y="0" width="100%" height="100%" />
        </clipPath>
      </defs>
      <g id="Layers" data-photopea-root="true">
        <g id="layer_white" data-name="白レイヤー" data-photopea-layer="true" data-color="#ffffff" fill="#ffffff" clip-path="url(#svgFrame)">
          <image width="${canvas.width}" height="${canvas.height}" href="${whiteDataURL}" />
        </g>
        <g id="layer_black" data-name="黒レイヤー" data-photopea-layer="true" data-color="#000000" fill="#000000" clip-path="url(#svgFrame)">
          <image width="${canvas.width}" height="${canvas.height}" href="${blackDataURL}" />
        </g>
      </g>
    </svg>
  `;
}

/**
 * カラーモードでレイヤー分割されたSVGを生成
 * @param {HTMLCanvasElement} canvas - 処理対象のキャンバス
 * @param {Object} options - 変換オプション
 * @returns {string} SVGデータ
 */
function createColorLayeredSVG(canvas, options) {
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  // 色の量子化（カラー数を減らす）
  // レイヤー数を制限（最大30レイヤー）
  const MAX_LAYERS = 30;
  let colorCount = options.colorQuantization || 8;
  if (colorCount > MAX_LAYERS) {
    console.log(`指定されたカラー数(${colorCount})が多すぎるため、${MAX_LAYERS}に制限します`);
    colorCount = MAX_LAYERS;
  }
  console.log(`レイヤー分割のための色数: ${colorCount}`);
  
  // 色の出現頻度をカウント
  const colorMap = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // 完全な透明部分は無視
    if (a === 0) continue;
    
    // 色を量子化（各色の精度を下げる）
    const step = Math.floor(256 / Math.cbrt(colorCount));
    const quantR = Math.floor(r / step) * step;
    const quantG = Math.floor(g / step) * step;
    const quantB = Math.floor(b / step) * step;
    
    const colorKey = `${quantR},${quantG},${quantB}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
  }
  
  // 出現頻度でソートして上位の色を選択
  const sortedColors = [...colorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, colorCount)
    .map(entry => entry[0]);
  
  console.log(`検出された主要色: ${sortedColors.length}色`);
  
  // 各色のレイヤーを作成
  const layers = [];
  
  for (let i = 0; i < sortedColors.length; i++) {
    const colorKey = sortedColors[i];
    const [r, g, b] = colorKey.split(',').map(Number);
    const hexColor = rgbToHex(r, g, b);
    
    // 色ごとにマスクを作成
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = width;
    layerCanvas.height = height;
    const layerCtx = layerCanvas.getContext('2d');
    
    // 元画像を描画
    layerCtx.drawImage(canvas, 0, 0);
    
    // その色以外を透明に
    const layerImgData = layerCtx.getImageData(0, 0, width, height);
    const layerData = layerImgData.data;
    
    const step = Math.floor(256 / Math.cbrt(colorCount));
    for (let j = 0; j < layerData.length; j += 4) {
      const pixelR = layerData[j];
      const pixelG = layerData[j + 1];
      const pixelB = layerData[j + 2];
      
      // 量子化して比較
      const quantPixelR = Math.floor(pixelR / step) * step;
      const quantPixelG = Math.floor(pixelG / step) * step;
      const quantPixelB = Math.floor(pixelB / step) * step;
      
      // この色のレイヤーに含めるかどうか判定
      const isThisColor = `${quantPixelR},${quantPixelG},${quantPixelB}` === colorKey;
      
      // この色でなければ透明に
      if (!isThisColor) {
        layerData[j + 3] = 0; // アルファ値を0に
      }
    }
    
    layerCtx.putImageData(layerImgData, 0, 0);
    
    // レイヤーの情報を作成
    let colorName;
    if (r === g && g === b) {
      if (r < 50) colorName = '黒系';
      else if (r > 200) colorName = '白系';
      else colorName = 'グレー系';
    } else if (r > g && r > b) {
      colorName = '赤系';
    } else if (g > r && g > b) {
      colorName = '緑系';
    } else if (b > r && b > g) {
      colorName = '青系';
    } else if (r > 200 && g > 200 && b < 100) {
      colorName = '黄系';
    } else {
      colorName = `カラー${i + 1}`;
    }
    
    layers.push({
      id: `layer_${i}_${r}_${g}_${b}`,
      name: colorName,
      color: hexColor,
      dataURL: layerCanvas.toDataURL('image/png')
    });
  }
  
  // RGB値を16進数カラーコードに変換
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  // レイヤー数を確認し、多すぎる場合は制限
  if (layers.length > MAX_LAYERS) {
    console.log(`レイヤー数(${layers.length})が多すぎるため、${MAX_LAYERS}に制限します`);
    
    // 各レイヤーのピクセル使用率を計算（重要度の指標として）
    const layerStats = layers.map(layer => {
      // 別のキャンバスにレイヤーを描画して非透明ピクセル数をカウント
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 100; // 小さいサイズで十分
      tempCanvas.height = 100;
      const scaleFactor = 100 / Math.max(width, height);
      
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.scale(scaleFactor, scaleFactor);
      
      const img = new Image();
      img.src = layer.dataURL;
      tempCtx.drawImage(img, 0, 0);
      
      // 非透明ピクセルをカウント
      const tempData = tempCtx.getImageData(0, 0, 100, 100).data;
      let nonTransparentPixels = 0;
      for (let i = 3; i < tempData.length; i += 4) {
        if (tempData[i] > 0) nonTransparentPixels++;
      }
      
      return {
        ...layer,
        importance: nonTransparentPixels / (100 * 100) // 重要度 (0-1)
      };
    });
    
    // 重要度でソートして上位のみを保持
    layerStats.sort((a, b) => b.importance - a.importance);
    layers.length = 0; // 配列をクリア
    layers.push(...layerStats.slice(0, MAX_LAYERS));
    
    console.log(`レイヤーを${MAX_LAYERS}個に制限しました`);
  }
  
  // オプション: レイヤー適用前の元画像を最下層に配置
  const baseLayerDataURL = canvas.toDataURL('image/png');
  
  // レイヤーをSVGとして出力（逆順に追加して正しい重ね順に）
  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
         width="${width}" height="${height}" 
         viewBox="0 0 ${width} ${height}">
      <defs>
        <clipPath id="svgFrame">
          <rect x="0" y="0" width="100%" height="100%" />
        </clipPath>
      </defs>
      <g id="Layers" data-photopea-root="true">
        <g id="layer_base" data-name="ベース画像" data-photopea-layer="true" style="display:none" clip-path="url(#svgFrame)">
          <image width="${width}" height="${height}" href="${baseLayerDataURL}" />
        </g>
        ${layers.reverse().map(layer => `
          <g id="${layer.id}" data-name="${layer.name}" data-photopea-layer="true" data-color="${layer.color}" fill="${layer.color}" clip-path="url(#svgFrame)">
            <image width="${width}" height="${height}" href="${layer.dataURL}" />
          </g>
        `).join('\n')}
      </g>
    </svg>
  `;
  
  return svgData;
}

/**
 * エラーメッセージを含むSVG画像を生成
 * @param {string} errorMessage - 表示するエラーメッセージ
 * @param {Function} resolve - 解決関数
 * @param {Image|HTMLCanvasElement} [originalImage] - 元の画像（オプション）
 */
function createErrorSVG(errorMessage, resolve, originalImage = null) {
  let width = 400;
  let height = 300;
  let svgData;
  
  console.error('SVG生成エラー:', errorMessage);
  
  // 元の画像がある場合は、その上にエラーメッセージを表示
  if (originalImage) {
    try {
      // キャンバスを使用して元の画像を描画
      const canvas = document.createElement('canvas');
      
      // 画像のサイズを取得
      if (originalImage instanceof HTMLImageElement) {
        width = originalImage.naturalWidth;
        height = originalImage.naturalHeight;
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(originalImage, 0, 0);
      } else if (originalImage instanceof HTMLCanvasElement) {
        width = originalImage.width;
        height = originalImage.height;
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(originalImage, 0, 0);
      }
      
      // エラーメッセージ表示用のオーバーレイを追加
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = width;
      overlayCanvas.height = height;
      
      const overlayCtx = overlayCanvas.getContext('2d');
      overlayCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      overlayCtx.fillRect(0, 0, width, height);
      
      // エラーメッセージを描画
      overlayCtx.fillStyle = '#dc3545';
      overlayCtx.font = 'bold 16px sans-serif';
      overlayCtx.textAlign = 'center';
      overlayCtx.fillText(`エラー: ${errorMessage || '変換に失敗しました'}`, width / 2, height / 2);
      
      // エラーの詳細ガイダンス
      overlayCtx.fillStyle = '#333333';
      overlayCtx.font = '14px sans-serif';
      overlayCtx.fillText('※別の画像や設定で再試行してください', width / 2, height / 2 + 30);
      
      const imageDataURL = canvas.toDataURL('image/png');
      const overlayDataURL = overlayCanvas.toDataURL('image/png');
      
      // レイヤーを持つSVGを生成
      svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
             width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <g id="Layers" data-photopea-root="true">
            <g id="layer_image" data-name="元画像" data-photopea-layer="true">
              <image width="${width}" height="${height}" href="${imageDataURL}" />
            </g>
            <g id="layer_error" data-name="エラー表示" data-photopea-layer="true">
              <image width="${width}" height="${height}" href="${overlayDataURL}" />
            </g>
          </g>
        </svg>
      `;
    } catch (e) {
      console.error('エラーSVG生成中にさらにエラーが発生:', e);
      // エラーが発生した場合は、シンプルなエラーSVGにフォールバック
      svgData = createSimpleErrorSVG(errorMessage, width, height);
    }
  } else {
    // 元の画像がない場合はシンプルなエラーSVG
    svgData = createSimpleErrorSVG(errorMessage, width, height);
  }
  
  resolve(svgData);
}

/**
 * シンプルなエラーメッセージSVGを生成
 * @param {string} errorMessage - エラーメッセージ
 * @param {number} width - 幅
 * @param {number} height - 高さ
 * @returns {string} SVGデータ
 */
function createSimpleErrorSVG(errorMessage, width, height) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f8f9fa" />
      <text x="50%" y="45%" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#dc3545">エラー: ${errorMessage || '変換に失敗しました'}</text>
      <text x="50%" y="55%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#333333">※別の画像や設定で再試行してください</text>
    </svg>
  `;
}

/**
 * SVGデータのレイヤー数を分析して詳細情報を出力する
 * @param {string} svgData - SVGデータ文字列
 * @param {string} stageName - 処理ステージの名前（デバッグ用）
 * @returns {number} レイヤー数
 */
function analyzeSvgLayers(svgData, stageName = '不明') {
  if (!svgData) {
    console.warn(`[${stageName}] SVGデータが空です`);
    return 0;
  }

  try {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
    
    // パースエラーチェック
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error(`[${stageName}] SVGパースエラー:`, parserError.textContent);
      return 0;
    }
    
    // グループ要素（レイヤー）をカウント
    const allGroups = svgDoc.querySelectorAll('g');
    const layers = Array.from(allGroups).filter(g => {
      // ルートグループやレイヤーコンテナは除外
      const id = g.getAttribute('id') || '';
      return !id.includes('Layers') && !g.getAttribute('data-photopea-root');
    });
    
    // 色情報を収集
    const colors = new Set();
    layers.forEach(layer => {
      const color = layer.getAttribute('fill') || layer.getAttribute('data-color');
      if (color) colors.add(color);
    });
    
    console.log(`[${stageName}] SVG分析結果:`, {
      totalGroups: allGroups.length,
      layerCount: layers.length,
      uniqueColors: colors.size,
      svgSize: svgData.length
    });
    
    return layers.length;
  } catch (e) {
    console.error(`[${stageName}] SVG分析エラー:`, e);
    return 0;
  }
}

/**
 * SVGのレイヤー数を強制的に制限する
 * レイヤーが多すぎる場合、類似した色や使用頻度の低いレイヤーを統合
 * @param {string} svgData - SVGデータ文字列
 * @param {number} maxLayers - 最大レイヤー数
 * @returns {string} 処理後のSVGデータ
 */
function enforceLayerLimit(svgData, maxLayers = 30) {
  console.log(`レイヤー数制限を実施: 最大${maxLayers}レイヤー`);
  
  if (!svgData) return svgData;
  
  try {
    // SVGデータを解析
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
    
    // パースエラーチェック
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVGパースエラー:', parserError.textContent);
      return svgData;
    }
    
    // ルートSVG要素
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) return svgData;
    
    // レイヤーコンテナを探す
    const layerContainers = svgDoc.querySelectorAll('g[id="Layers"], g[data-photopea-root="true"]');
    if (layerContainers.length === 0) return svgData;
    
    const layerContainer = layerContainers[0];
    
    // レイヤーを収集
    const layers = Array.from(layerContainer.children).filter(el => 
      el.tagName.toLowerCase() === 'g' && !el.getAttribute('data-photopea-root')
    );
    
    // レイヤー数が制限以下なら何もしない
    if (layers.length <= maxLayers) {
      console.log(`レイヤー数(${layers.length})は制限内です。処理をスキップします。`);
      return svgData;
    }
    
    console.log(`レイヤー数(${layers.length})が制限(${maxLayers})を超えています。レイヤー統合を開始...`);
    
    // レイヤーの分析情報を収集
    const layerInfo = layers.map(layer => {
      // 色情報を取得
      const color = layer.getAttribute('fill') || layer.getAttribute('data-color') || '#000000';
      
      // レイヤー内の要素数をカウント
      const elementCount = layer.querySelectorAll('*').length;
      
      // レイヤーのID
      const id = layer.getAttribute('id') || '';
      
      // レイヤー名
      const name = layer.getAttribute('data-name') || '';
      
      // 色をRGB値に変換
      let r = 0, g = 0, b = 0;
      try {
        const hex = color.replace(/^#/, '');
        if (hex.length === 3) {
          r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
          g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
          b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
        } else if (hex.length === 6) {
          r = parseInt(hex.substring(0, 2), 16);
          g = parseInt(hex.substring(2, 4), 16);
          b = parseInt(hex.substring(4, 6), 16);
        }
      } catch (e) {
        console.warn('色解析エラー:', color);
      }
      
      return {
        element: layer,
        color: color,
        id: id,
        name: name,
        elementCount: elementCount,
        r, g, b
      };
    });
    
    // 色の類似度を計算する関数
    const calculateColorDistance = (color1, color2) => {
      const dr = color1.r - color2.r;
      const dg = color1.g - color2.g;
      const db = color1.b - color2.b;
      return Math.sqrt(dr*dr + dg*dg + db*db);
    };
    
    // 類似色・要素数の少ないレイヤーを特定してグループ化
    const targetLayers = maxLayers; // 目標レイヤー数
    let layersToMerge = layers.length - targetLayers; // マージする必要があるレイヤー数
    
    if (layersToMerge <= 0) return svgData;
    
    console.log(`${layersToMerge}個のレイヤーをマージする必要があります`);
    
    // マージするレイヤーのグループ
    const mergeGroups = [];
    const processedLayers = new Set();
    
    // 1. 要素数の少ないレイヤーから処理
    layerInfo.sort((a, b) => a.elementCount - b.elementCount);
    
    // 2. 類似色を持つレイヤーをグループ化
    const colorThreshold = 30; // 色の類似度閾値
    
    for (let i = 0; i < layerInfo.length && layersToMerge > 0; i++) {
      const layer = layerInfo[i];
      
      if (processedLayers.has(layer.id)) continue;
      
      // 類似色のレイヤーを見つける
      const similarLayers = layerInfo.filter(other => 
        !processedLayers.has(other.id) && 
        other.id !== layer.id && 
        calculateColorDistance(layer, other) < colorThreshold
      );
      
      if (similarLayers.length > 0) {
        // グループを作成
        const group = [layer, ...similarLayers];
        mergeGroups.push(group);
        
        // 処理済みとしてマーク
        group.forEach(l => processedLayers.add(l.id));
        
        // マージするレイヤー数を更新
        layersToMerge -= Math.min(layersToMerge, similarLayers.length);
      }
    }
    
    // 3. レイヤーのマージを実行
    mergeGroups.forEach(group => {
      if (group.length <= 1) return;
      
      // メインレイヤー（通常は要素数が最も多いもの）
      group.sort((a, b) => b.elementCount - a.elementCount);
      const mainLayer = group[0].element;
      
      // 残りのレイヤーの要素をメインレイヤーに移動
      for (let i = 1; i < group.length; i++) {
        const layer = group[i].element;
        
        // レイヤー内のすべての要素をメインレイヤーに移動
        while (layer.firstChild) {
          mainLayer.appendChild(layer.firstChild);
        }
        
        // 空になったレイヤーを削除
        if (layer.parentNode) {
          layer.parentNode.removeChild(layer);
        }
      }
      
      console.log(`${group.length}個のレイヤーをマージしました。レイヤーID: ${mainLayer.getAttribute('id')}`);
    });
    
    // 処理後のレイヤー数を確認
    const remainingLayers = layerContainer.querySelectorAll('g');
    console.log(`レイヤー統合後のレイヤー数: ${remainingLayers.length}`);
    
    // 変更をSVG文字列に反映
    return new XMLSerializer().serializeToString(svgDoc);
  } catch (e) {
    console.error('レイヤー数制限処理中にエラーが発生しました:', e);
    return svgData;
  }
}