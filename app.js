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
    if (!svgData || typeof svgData !== 'string' || !svgData.includes('<svg')) {
      console.error('無効なSVGデータ:', svgData);
      useImageBasedFallback();
      return;
    }
    
    // レイヤーが含まれているか確認
    const layerCount = (svgData.match(/<g[^>]*id="layer_/g) || []).length;
    console.log(`生成されたSVGには ${layerCount} 個のレイヤーが含まれています`);
    
    // レイヤーが少なすぎる場合は警告
    if (layerCount <= 1 && conversionOptions.colorMode === 'color') {
      console.warn('レイヤーが十分に生成されていません。色の量子化値を増やして再試行することを検討してください。');
      
      // 空のLayersグループがある場合
      const emptyLayersGroup = svgData.includes('<g id="Layers" data-photopea-root="true"></g>') || 
                             svgData.includes('<g id="Layers"></g>');
      
      if (emptyLayersGroup) {
        console.error('レイヤーグループが空です。レイヤー生成に失敗しました。');
        
        // 最初の試行でエラーの場合、より詳細なオプションで再試行
        if (!conversionOptions._retried) {
          console.log('レイヤー生成に失敗したため、詳細モードで再試行します');
          
          // 再試行のコピーを作成して元のオプションを変更しない
          const retryOptions = {
            ...conversionOptions,
            colorQuantization: Math.min(256, conversionOptions.colorQuantization * 2),
            minColorArea: 5, // より小さい色領域も検出
            edgeThreshold: 10, // よりシャープなエッジ検出
            detailBoost: true, // 詳細モードを有効化
            forceSeparateLayers: true, // 強制的にレイヤーを分離
            _retried: true, // 再試行フラグ
            timeout: 15000 // 15秒のタイムアウトに制限
          };
          
          // タイムアウト処理を設定 (15秒)
          const timeoutId = setTimeout(() => {
            console.warn('レイヤー再生成がタイムアウトしました。強制分割を試みます。');
            try {
              // 強制的にSVGのレイヤーを分割（セーフモード）
              const forcedSvgData = forceSplitSvgLayers(svgData, true);
              if (forcedSvgData) {
                resolve(forcedSvgData);
              } else {
                resolve(svgData); // 失敗した場合は元のSVGを使用
              }
            } catch (timeoutError) {
              console.error('タイムアウト処理中のエラー:', timeoutError);
              resolve(svgData); // エラー時は元のSVGを使用
            }
          }, 15000);
          
          try {
            // レイヤーアダプタまたはImageTracerのどちらかを使用
            if (typeof SVGLayerAdapter !== 'undefined' && typeof SVGLayerAdapter.fileToSVG === 'function') {
              console.log('SVGレイヤーアダプターを使用した再試行');
              SVGLayerAdapter.fileToSVG(file, retryOptions, function(error, retrySvgData) {
                clearTimeout(timeoutId); // タイムアウトをクリア
                
                if (error || !retrySvgData) {
                  console.error('SVGレイヤーアダプター再試行エラー:', error);
                  
                  // エラー時は強制レイヤー分割を試みる（セーフモード）
                  try {
                    const forcedSvgData = forceSplitSvgLayers(svgData, true);
                    if (forcedSvgData) {
                      resolve(forcedSvgData);
                    } else {
                      resolve(svgData); // 失敗した場合は元のSVGを使用
                    }
                  } catch (e) {
                    console.error('強制分割エラー:', e);
                    resolve(svgData);
                  }
                } else {
                  // 再試行成功、レイヤー数をチェック
                  const retryLayerCount = (retrySvgData.match(/<g[^>]*id="layer_/g) || []).length;
                  console.log(`再試行後のレイヤー数: ${retryLayerCount}`);
                  
                  if (retryLayerCount > 1) {
                    // 再試行成功
                    resolve(retrySvgData);
                  } else {
                    // 再試行してもレイヤー不足、強制分割を試みる（セーフモード）
                    try {
                      const forcedSvgData = forceSplitSvgLayers(retrySvgData, true);
                      resolve(forcedSvgData || retrySvgData);
                    } catch (e) {
                      console.error('強制分割エラー:', e);
                      resolve(retrySvgData);
                    }
                  }
                }
              });
            } else if (typeof ImageTracer !== 'undefined' && typeof ImageTracer.fileToSVG === 'function') {
              console.log('ImageTracerを使用した再試行');
              ImageTracer.fileToSVG(file, retryOptions, function(error, retrySvgData) {
                clearTimeout(timeoutId); // タイムアウトをクリア
                
                if (error || !retrySvgData) {
                  console.error('ImageTracer再試行エラー:', error);
                  try {
                    const forcedSvgData = forceSplitSvgLayers(svgData, true);
                    resolve(forcedSvgData || svgData);
                  } catch (e) {
                    console.error('強制分割エラー:', e);
                    resolve(svgData);
                  }
                } else {
                  resolve(retrySvgData);
                }
              });
            } else {
              // どちらも利用できない場合は強制分割（セーフモード）
              clearTimeout(timeoutId);
              console.log('変換ライブラリが利用できません、強制分割を試みます');
              try {
                const forcedSvgData = forceSplitSvgLayers(svgData, true);
                resolve(forcedSvgData || svgData);
              } catch (e) {
                console.error('強制分割エラー:', e);
                resolve(svgData);
              }
            }
          } catch (retryError) {
            clearTimeout(timeoutId);
            console.error('再試行処理中のエラー:', retryError);
            resolve(svgData); // エラー時は元のSVGを使用
          }
          
          return; // 処理終了、結果はコールバック内で返される
        }
        
        // 既に再試行済みか、最初の試行でない場合、強制分割を試みる（セーフモード）
        console.log('強制的にレイヤー分割を実行します');
        try {
          const forcedSvgData = forceSplitSvgLayers(svgData, true);
          if (forcedSvgData && forcedSvgData !== svgData) {
            // 分割後のレイヤー数をチェック
            const newLayerCount = (forcedSvgData.match(/<g[^>]*id="layer_/g) || []).length;
            console.log(`強制分割後のレイヤー数: ${newLayerCount}`);
            
            if (newLayerCount > 0) {
              console.log('強制レイヤー分割が成功しました');
              resolve(forcedSvgData);
              return;
            }
          }
        } catch (splitError) {
          console.error('強制レイヤー分割エラー:', splitError);
          // エラー時も続行し、元のSVGを使用
        }
      }
    }
    
    // 問題なければそのまま元のSVGを返す
    console.log('SVG変換完了:', svgData.substring(0, 100) + '...');
    resolve(svgData);
  }
}

/**
 * SVGを色ごとに強制的にレイヤー分割する関数
 * SVGのパスやポリゴンを色ごとにグループ化して新しいレイヤー構造を作成
 * @param {string} svgData - 分割するSVGデータ
 * @param {boolean} safeMode - パフォーマンス向上とクラッシュ防止のためのセーフモード
 * @returns {string} レイヤー分割されたSVGデータ
 */
function forceSplitSvgLayers(svgData, safeMode = false) {
  console.log('SVGの強制レイヤー分割を開始します');
  
  // 処理タイムアウト設定（5秒）
  let timeoutTriggered = false;
  const operationTimeout = setTimeout(() => {
    timeoutTriggered = true;
    console.warn('SVG強制分割処理がタイムアウトしました');
  }, 5000);
  
  try {
    // SVGパース
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgData, 'image/svg+xml');
    
    // パースエラーチェック
    const parserError = svgDoc.querySelector('parsererror');
    if (parserError) {
      console.error('SVGパースエラー:', parserError.textContent);
      clearTimeout(operationTimeout);
      return null;
    }
    
    // ルートSVG要素
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) {
      console.error('SVG要素が見つかりません');
      clearTimeout(operationTimeout);
      return null;
    }
    
    // SVG属性取得
    const viewBox = svgElement.getAttribute('viewBox');
    const width = svgElement.getAttribute('width');
    const height = svgElement.getAttribute('height');
    
    // パスとポリゴン要素を収集
    const paths = Array.from(svgDoc.querySelectorAll('path'));
    const polygons = Array.from(svgDoc.querySelectorAll('polygon'));
    const elements = [...paths, ...polygons];
    
    console.log(`${paths.length}個のパスと${polygons.length}個のポリゴンが見つかりました`);
    
    // 要素が少なすぎる場合はそのまま返す
    if (elements.length === 0) {
      console.warn('分割対象の要素が見つかりません');
      clearTimeout(operationTimeout);
      return null;
    }
    
    // 安全チェック：要素数が多すぎる場合はサンプリング
    const MAX_ELEMENTS = safeMode ? 1000 : 5000;
    let processedElements = elements;
    
    if (elements.length > MAX_ELEMENTS) {
      console.warn(`要素が多すぎます(${elements.length}個)。サンプリングします。`);
      // 要素の一部だけを使用（均等にサンプリング）
      const samplingRate = MAX_ELEMENTS / elements.length;
      processedElements = elements.filter((_, index) => {
        return Math.random() < samplingRate;
      });
      console.log(`${processedElements.length}個の要素にサンプリングしました`);
    }
    
    // 色ごとにグループ化
    const colorGroups = {};
    
    // 色の抽出関数
    const getElementColor = (element) => {
      // タイムアウトチェック
      if (timeoutTriggered) {
        throw new Error('処理タイムアウト');
      }
      
      const fill = element.getAttribute('fill') || 'none';
      const stroke = element.getAttribute('stroke') || 'none';
      
      // style属性からの色抽出
      let fillFromStyle = 'none';
      let strokeFromStyle = 'none';
      
      const style = element.getAttribute('style');
      if (style) {
        const fillMatch = style.match(/fill:\s*([^;]+)/);
        if (fillMatch) fillFromStyle = fillMatch[1];
        
        const strokeMatch = style.match(/stroke:\s*([^;]+)/);
        if (strokeMatch) strokeFromStyle = strokeMatch[1];
      }
      
      // 最終的な色を決定
      const finalFill = (fill !== 'none') ? fill : fillFromStyle;
      const finalStroke = (stroke !== 'none') ? stroke : strokeFromStyle;
      
      return `${finalFill}_${finalStroke}`;
    };
    
    // 要素を色ごとにグループ化
    processedElements.forEach((element, index) => {
      // 大量処理時の定期チェック
      if (index % 100 === 0 && timeoutTriggered) {
        throw new Error('処理タイムアウト');
      }
      
      const colorKey = getElementColor(element);
      if (!colorGroups[colorKey]) {
        colorGroups[colorKey] = [];
      }
      colorGroups[colorKey].push(element.outerHTML);
    });
    
    // 色の類似性を計算する関数
    const calculateColorSimilarity = (color1, color2) => {
      // 色文字列から16進数部分を抽出する
      const extractHexColor = (colorStr) => {
        const hexMatch = colorStr.match(/#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/);
        return hexMatch ? hexMatch[0] : null;
      };
      
      // 16進数からRGB値に変換
      const hexToRgb = (hex) => {
        if (!hex || hex === 'none') return null;
        
        // #RGB形式を#RRGGBB形式に変換
        if (hex.length === 4) {
          hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
        }
        
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      };
      
      // RGB文字列からRGB値に変換
      const rgbStrToRgb = (rgbStr) => {
        const match = rgbStr.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
        return match ? {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10)
        } : null;
      };
      
      // カラーキーから色部分を抽出
      const color1Parts = color1.split('_');
      const color2Parts = color2.split('_');
      
      const fill1 = extractHexColor(color1Parts[0]);
      const fill2 = extractHexColor(color2Parts[0]);
      
      // 塗りつぶし色がない場合は類似していないと判断
      if (!fill1 || !fill2 || fill1 === 'none' || fill2 === 'none') {
        return 0;
      }
      
      // RGB値に変換
      let rgb1 = fill1.startsWith('#') ? hexToRgb(fill1) : rgbStrToRgb(fill1);
      let rgb2 = fill2.startsWith('#') ? hexToRgb(fill2) : rgbStrToRgb(fill2);
      
      if (!rgb1 || !rgb2) return 0;
      
      // RGB空間でのユークリッド距離を計算
      const distance = Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
      );
      
      // 最大距離は√(255²+255²+255²) ≈ 441.7
      // 類似度を0～1の範囲に正規化（距離が小さいほど類似度は高い）
      return Math.max(0, 1 - distance / 441.7);
    };
    
    // 色グループをマージする処理
    const mergeColorGroups = () => {
      const colorKeys = Object.keys(colorGroups);
      const similarityThreshold = 0.9; // 類似度がこの値以上なら同じグループとみなす
      const MAX_LAYERS = 8; // 最大レイヤー数
      
      // 色グループが少ない場合はそのまま返す
      if (colorKeys.length <= MAX_LAYERS) {
        return colorGroups;
      }
      
      console.log(`色グループが多すぎます(${colorKeys.length}個)。マージを試みます。`);
      
      // 新しいグループを作成
      const mergedGroups = {};
      const processedKeys = new Set();
      
      // 各色グループについて
      for (let i = 0; i < colorKeys.length; i++) {
        const key = colorKeys[i];
        
        // 既に処理済みならスキップ
        if (processedKeys.has(key)) continue;
        
        // 新しいグループを作成
        const mergedKey = key;
        mergedGroups[mergedKey] = [...colorGroups[key]];
        processedKeys.add(key);
        
        // 類似した他のグループを探して結合
        for (let j = i + 1; j < colorKeys.length; j++) {
          const otherKey = colorKeys[j];
          
          // 既に処理済みならスキップ
          if (processedKeys.has(otherKey)) continue;
          
          // 類似度を計算
          const similarity = calculateColorSimilarity(key, otherKey);
          
          // 類似度が閾値以上ならマージ
          if (similarity >= similarityThreshold) {
            mergedGroups[mergedKey].push(...colorGroups[otherKey]);
            processedKeys.add(otherKey);
          }
        }
      }
      
      // マージ後のグループ数が依然として多すぎる場合、出現頻度の高い上位グループだけを保持
      const mergedKeys = Object.keys(mergedGroups);
      if (mergedKeys.length > MAX_LAYERS) {
        console.log(`マージ後も色グループが多すぎます(${mergedKeys.length}個)。上位${MAX_LAYERS}個を保持します。`);
        
        // 要素数でソートし、上位グループのみを保持
        const sortedGroups = mergedKeys
          .map(key => ({ key, count: mergedGroups[key].length }))
          .sort((a, b) => b.count - a.count)
          .slice(0, MAX_LAYERS);
        
        const finalGroups = {};
        sortedGroups.forEach(group => {
          finalGroups[group.key] = mergedGroups[group.key];
        });
        
        return finalGroups;
      }
      
      return mergedGroups;
    };
    
    // 色グループをマージ
    const finalColorGroups = mergeColorGroups();
    
    // 色グループの数をログ
    const groupCount = Object.keys(finalColorGroups).length;
    console.log(`${groupCount}個の色グループを最終的に作成しました`);
    
    // 新しいSVG構造を構築
    const newSvgTemplate = `
      <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
           viewBox="${viewBox || '0 0 800 600'}" width="${width || '800'}" height="${height || '600'}">
        <defs>
          <clipPath id="svgFrame">
            <rect x="0" y="0" width="100%" height="100%" />
          </clipPath>
        </defs>
        <g id="Layers" data-photopea-root="true">
          ${Object.entries(finalColorGroups).map(([color, elements], index) => {
            // タイムアウトチェック
            if (timeoutTriggered) {
              throw new Error('処理タイムアウト');
            }
            
            const colorName = color.replace(/[^a-zA-Z0-9]/g, '_');
            return `
              <g id="layer_${index}_${colorName.substring(0, 15)}" clip-path="url(#svgFrame)">
                ${elements.join('\n')}
              </g>
            `;
          }).join('\n')}
        </g>
      </svg>
    `;
    
    // 処理完了
    console.log('強制レイヤー分割が完了しました');
    clearTimeout(operationTimeout);
    return newSvgTemplate;
    
  } catch (error) {
    console.error('強制レイヤー分割中にエラーが発生しました:', error);
    clearTimeout(operationTimeout);
    
    // タイムアウトエラーの場合は null を返す
    if (timeoutTriggered || error.message === '処理タイムアウト') {
      return null;
    }
    
    // その他のエラーでは元のSVGをそのまま返す
    return svgData;
  }
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
      
      console.log(`SVGの元の寸法: ${width}x${height}`);
      
      // viewBoxが設定されていない場合は設定
      if (!svgElement.getAttribute('viewBox')) {
        console.log('viewBoxが設定されていないため設定します');
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
      
      // viewBoxを確認し、不正な場合は修正
      const viewBox = svgElement.getAttribute('viewBox');
      if (!viewBox || viewBox.split(' ').length < 4) {
        console.log('viewBoxの形式が不正なため修正します');
        svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
      }
      
      // 必ず幅と高さの属性があることを確認
      if (!svgElement.hasAttribute('width')) {
        svgElement.setAttribute('width', width);
      }
      
      if (!svgElement.hasAttribute('height')) {
        svgElement.setAttribute('height', height);
      }
      
      // アスペクト比を維持しながらプレビュー領域に収まるように調整
      svgElement.style.width = 'auto';
      svgElement.style.height = 'auto';
      svgElement.style.maxWidth = '100%';
      svgElement.style.maxHeight = '280px';
      svgElement.style.display = 'block';
      svgElement.style.margin = '0 auto';
      svgElement.style.objectFit = 'contain';
      
      // プリザベアスペクトレシオを設定
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      
      // SVG内の変換グループがあれば調整
      const mainGroup = svgElement.querySelector('g[id="Layers"], g[data-photopea-root="true"], g[id="document"]');
      if (mainGroup) {
        console.log('メインレイヤーグループを検出しました');
        mainGroup.setAttribute('transform-origin', 'center');
      }
      
      // SVG内のすべてのパスに対して、ビューボックス外への突き抜けを防止
      const allPaths = svgElement.querySelectorAll('path');
      if (allPaths.length > 0) {
        // クリッピングパスがまだなければ追加
        if (!svgElement.querySelector('clipPath#svg-boundary')) {
          const defs = svgElement.querySelector('defs');
          if (!defs) {
            const newDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            svgElement.prepend(newDefs);
          }
          
          const defsElement = svgElement.querySelector('defs');
          const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
          clipPath.setAttribute('id', 'svg-boundary');
          
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', '0');
          rect.setAttribute('y', '0');
          rect.setAttribute('width', width);
          rect.setAttribute('height', height);
          
          clipPath.appendChild(rect);
          defsElement.appendChild(clipPath);
        }
        
        // すべてのパスにクリッピングパスを適用
        allPaths.forEach(path => {
          path.setAttribute('clip-path', 'url(#svg-boundary)');
        });
      }
      
      // SVG全体にオーバーフロー制限を追加
      svgElement.style.overflow = 'hidden';
      
      console.log(`SVG表示設定: サイズ=${width}x${height}, viewBox=${svgElement.getAttribute('viewBox')}, aspectRatio=${svgElement.getAttribute('preserveAspectRatio')}`);
    } else {
      console.warn('SVG要素が見つかりませんでした');
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
    uploadArea.innerHTML = `
      <p>画像をここにドラッグ&ドロップ</p>
      <p>または</p>
      <div class="upload-button">画像を選択</div>
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
    
    // ファイル入力をリセット
  if (fileInput) {
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
 */
function useImageBasedFallback(file, options, resolve, reject) {
  console.log('画像ベースのフォールバック処理を開始');
  
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
      
      try {
        // 画像をキャンバスに描画
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const maxSize = options.maxImageSize || 2000;
        
        // 必要に応じてリサイズ
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
        
        // カラーモードに応じた処理
        let svgData;
        
        if (options.colorMode === 'bw') {
          // 白黒モードの場合は2値化処理
          svgData = createBWFallbackSVG(canvas, options.threshold || 128);
        } else {
          // カラーモードの場合は画像を埋め込む
          const dataURL = canvas.toDataURL('image/png');
          svgData = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
              <g id="Layers" data-photopea-root="true">
                <g id="layer_image" data-photopea-layer="true">
                  <image width="${width}" height="${height}" href="${dataURL}" />
                </g>
              </g>
            </svg>
          `;
        }
        
        // URLをクリーンアップ
        URL.revokeObjectURL(objectURL);
        resolve(svgData);
        
      } catch (canvasError) {
        console.error('キャンバス処理エラー:', canvasError);
        URL.revokeObjectURL(objectURL);
        createErrorSVG(canvasError.message, resolve);
      }
    };
    
    img.onerror = function(error) {
      clearTimeout(timeoutId);
      console.error('画像読み込みエラー:', error);
      URL.revokeObjectURL(objectURL);
      createErrorSVG('画像の読み込みに失敗しました', resolve);
    };
    
    img.src = objectURL;
    
  } catch (error) {
    console.error('画像フォールバックエラー:', error);
    createErrorSVG(error.message, resolve);
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
  
  // SVG生成
  const dataURL = canvas.toDataURL('image/png');
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
      <g id="Layers" data-photopea-root="true">
        <g id="layer_bw" data-photopea-layer="true">
          <image width="${canvas.width}" height="${canvas.height}" href="${dataURL}" />
        </g>
      </g>
    </svg>
  `;
}

/**
 * エラーメッセージを含むSVG画像を生成
 * @param {string} errorMessage - 表示するエラーメッセージ
 * @param {Function} resolve - 解決関数
 */
function createErrorSVG(errorMessage, resolve) {
  const width = 400;
  const height = 300;
  const svgData = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f8f9fa" />
      <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#dc3545">エラー: ${errorMessage || '変換に失敗しました'}</text>
    </svg>
  `;
  
  resolve(svgData);
}