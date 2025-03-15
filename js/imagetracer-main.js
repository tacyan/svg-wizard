/**
 * @module ImageTracer
 * @description SVG Wizard - 画像をSVGに変換するためのメインモジュール
 * @version 3.5.1
 * @license MIT
 * 
 * このファイルは、ImageTracerの主要APIを提供し、分割された各モジュール（コア、レイヤー、UI、ユーティリティ）を統合します。
 * ユーザーはこのモジュールを通じて画像からSVGへの変換機能を利用できます。
 * 
 * - 複数のカラーモード（カラー、白黒）をサポート
 * - レイヤー分離機能とイラストレーター互換SVG出力
 * - 進捗状況の報告と細かな設定オプション
 */

// グローバル名前空間にImageTracerを定義
window.ImageTracer = (function() {
  // 他のモジュールへの参照を保持
  const core = window.ImageTracerCore;
  const layers = window.ImageTracerLayers;
  const ui = window.ImageTracerUI;
  const utils = window.ImageTracerUtils;
  
  // モジュールが正しく読み込まれているか確認
  if (!core || !layers || !ui || !utils) {
    console.error('ImageTracerモジュールが正しく読み込まれていません。必要なモジュールファイルを確認してください。');
  }
  
  // デフォルトオプション
  const defaultOptions = {
    // 画像処理オプション
    threshold: 128,          // 白黒モード用の閾値
    colorMode: 'color',      // 'color' または 'bw'
    colorQuantization: 16,   // カラーモードの色数
    blurRadius: 0,           // ぼかし効果の強さ
    simplify: 0.5,           // SVGパスの単純化レベル
    scale: 1,                // 出力スケール
    strokeWidth: 0,          // 白黒モードのストローク幅
    
    // レイヤーオプション
    enableLayers: true,      // レイヤー分離を有効化
    layerNaming: 'color',    // レイヤー命名方法（'color', 'index', 'auto'）
    illustratorCompat: true, // イラストレーター互換出力
    
    // パフォーマンスオプション
    maxImageSize: 2000,      // 最大画像サイズ
    timeout: 60000,          // タイムアウト（ミリ秒）
    progressCallback: null,  // 進捗コールバック関数
    quality: 0.8             // 画像品質（0.0～1.0）
  };
  
  /**
   * 画像ファイルをSVGに変換する
   * @param {File} file - 変換する画像ファイル
   * @param {Object} options - 変換オプション
   * @param {Function} callback - 完了時のコールバック関数(error, svgData)
   */
  function fileToSVG(file, options, callback) {
    try {
      // オプションをデフォルト値とマージ
      options = Object.assign({}, defaultOptions, options);
      
      // タイマーを開始
      const timer = utils.createTimer ? utils.createTimer() : { start: () => {}, stop: () => {} };
      timer.start();
      
      // 進捗報告の準備
      const reportProgress = function(stage, percent) {
        if (typeof options.progressCallback === 'function') {
          options.progressCallback(stage, percent);
        }
      };
      
      // 画像サイズ制限
      const maxImageSize = options.maxImageSize || defaultOptions.maxImageSize;
      
      // 画像を読み込み
      reportProgress('画像読み込み', 5);
      utils.createImageFromFile(file)
        .then(function(image) {
          reportProgress('画像解析', 15);
          
          // 大きすぎる画像のリサイズを実行
          let processedImage = image;
          if (image.naturalWidth > maxImageSize || image.naturalHeight > maxImageSize) {
            reportProgress('画像リサイズ', 20);
            const canvas = core.resizeImage(image, maxImageSize);
            processedImage = canvas;
          }
          
          // 画像データを取得
          reportProgress('画像データ抽出', 25);
          let imageData;
          try {
            imageData = core.getImageData(processedImage);
          } catch (dataError) {
            throw new Error('画像データの取得に失敗しました: ' + dataError.message);
          }
          
          // 必要に応じて画像をぼかす
          let processedData = imageData;
          if (options.blurRadius > 0) {
            reportProgress('ぼかし効果適用', 30);
            processedData = core.applyBlur(imageData, options.blurRadius);
          }
          
          reportProgress('SVG変換', 40);
          
          // メモリ確保のために一部の大きなオブジェクトを解放
          processedImage = null;
          
          // カラーモードに応じた処理
          let svgData;
          try {
            if (options.colorMode === 'bw') {
              // 白黒モード
              svgData = processBlackAndWhite(processedData, options);
            } else {
              // カラーモード
              svgData = processColor(processedData, options);
            }
          } catch (conversionError) {
            console.error('SVG変換エラー:', conversionError);
            // フォールバックSVGを生成
            svgData = core.createFallbackSVG(
              processedData.width, 
              processedData.height,
              '変換エラー: ' + conversionError.message
            );
          }
          
          // SVGデータの整合性チェック
          if (!svgData || !svgData.includes('<svg') || !svgData.includes('</svg>')) {
            throw new Error('SVGデータの生成に失敗しました。不完全なSVGが生成されました。');
          }
          
          reportProgress('仕上げ', 90);
          
          // メモリ解放
          processedData = null;
          
          // 結果を返す
          callback(null, svgData);
          
          reportProgress('完了', 100);
        })
        .catch(function(error) {
          console.error('SVG変換エラー:', error);
          
          // 何らかのSVGを返すために、基本的なエラーSVGを生成
          try {
            const errorSvg = core.createFallbackSVG(
              400, 
              300, 
              'エラー: ' + (error.message || '変換に失敗しました')
            );
            callback(error, errorSvg);
          } catch (fallbackError) {
            // フォールバックすら失敗した場合
            callback(error, null);
          }
        });
    } catch (error) {
      console.error('予期せぬエラー:', error);
      callback(error, null);
    }
  }
  
  /**
   * 白黒モードでSVG変換を行う
   * @param {ImageData} imageData - 処理する画像データ
   * @param {Object} options - 変換オプション
   * @returns {string} SVGデータ
   * @private
   */
  function processBlackAndWhite(imageData, options) {
    // Potraceが読み込まれているか確認
    const potraceAvailable = typeof window.Potrace !== 'undefined';
    const fallbackMode = window.potraceFallbackMode === true;
    
    if (!potraceAvailable && !fallbackMode) {
      console.warn('Potraceライブラリが読み込まれていません。フォールバック処理を実行します。');
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    
    // Potraceが利用可能な場合
    if (potraceAvailable) {
      try {
        // Potraceパラメータを設定
        const params = {
          turdsize: 2,
          turnpolicy: Potrace.TURNPOLICY_MINORITY,
          optcurve: true,
          optTolerance: 0.2,
          threshold: options.threshold,
          blackOnWhite: true
        };
        
        // Potraceでトレース
        Potrace.setParameter(params);
        Potrace.loadImageFromCanvas(canvas);
        const svgData = Potrace.getSVG(1);
        
        // SVGデータの整合性チェック
        if (!svgData || !svgData.includes('<svg') || !svgData.includes('</svg>')) {
          throw new Error('Potraceによる変換結果が不正です');
        }
        
        // レイヤーを作成（単一レイヤー）
        if (options.illustratorCompat) {
          return layers.createAICompatSVG([{
            id: 'layer1',
            name: '白黒レイヤー',
            content: svgData.match(/<path[^>]*>/g).join(''),
            color: '#000000',
            visible: true
          }], imageData.width, imageData.height, options);
        }
        
        return svgData;
      } catch (error) {
        console.error('Potraceによる変換に失敗しました:', error);
        // フォールバック処理に移行
      }
    }
    
    // フォールバック処理（簡易SVG生成）
    console.warn('簡易SVG生成モードを使用します');
    
    // Base64画像を埋め込んだSVGを作成
    try {
      const dataURL = canvas.toDataURL('image/png', options.quality || 0.8);
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageData.width}" height="${imageData.height}">
        <image width="${imageData.width}" height="${imageData.height}" href="${dataURL}" />
      </svg>`;
    } catch (error) {
      console.error('フォールバックSVG生成に失敗しました:', error);
      return core.createFallbackSVG(imageData.width, imageData.height, 'SVG生成に失敗しました');
    }
  }
  
  /**
   * カラーモードでSVG変換を行う
   * @param {ImageData} imageData - 処理する画像データ
   * @param {Object} options - 変換オプション
   * @returns {string} SVGデータ
   * @private
   */
  function processColor(imageData, options) {
    // Potraceが読み込まれているか確認
    const potraceAvailable = typeof window.Potrace !== 'undefined';
    const fallbackMode = window.potraceFallbackMode === true;
    
    if (!potraceAvailable && !fallbackMode) {
      console.warn('Potraceライブラリが読み込まれていません。フォールバック処理を実行します。');
    }
    
    // 色の量子化を行う
    const colorCount = Math.min(64, Math.max(2, options.colorQuantization));
    
    try {
      const palette = core.quantizeColors(imageData, colorCount);
      
      // カラーごとにレイヤーを作成
      const layerItems = [];
      
      // トレース用のキャンバス（再利用）
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      
      // 各色ごとに処理
      for (let i = 0; i < palette.length; i++) {
        const color = palette[i];
        
        // 進捗更新
        if (typeof options.progressCallback === 'function') {
          options.progressCallback('色処理中', 40 + (i / palette.length) * 40);
        }
        
        // この色のみのマスク画像を作成
        const maskData = core.createColorMask(imageData, color);
        
        // Potraceが読み込まれていない場合は簡易処理
        if (!potraceAvailable && !fallbackMode) {
          continue;
        }
        
        // マスクをトレース
        ctx.putImageData(maskData, 0, 0);
        
        let svgPaths = '';
        
        if (potraceAvailable) {
          try {
            // Potraceパラメータを設定
            const params = {
              turdsize: 2,
              turnpolicy: Potrace.TURNPOLICY_MINORITY,
              optcurve: true,
              optTolerance: options.simplify,
              threshold: 128,
              blackOnWhite: true
            };
            
            // Potraceでトレース
            Potrace.setParameter(params);
            Potrace.loadImageFromCanvas(canvas);
            const svgData = Potrace.getSVG(1);
            svgPaths = svgData.match(/<path[^>]*>/g);
            
            if (svgPaths && svgPaths.length > 0) {
              svgPaths = svgPaths.join('');
            } else {
              svgPaths = '';
            }
          } catch (traceError) {
            console.error(`色 #${i + 1} のトレースに失敗しました:`, traceError);
            svgPaths = '';
          }
        } else {
          // Base64画像を使用したフォールバック（高いメモリ使用量を避けるため実装しない）
          svgPaths = '';
        }
        
        // レイヤー情報を作成
        const colorHex = utils.rgbToHex(color[0], color[1], color[2]);
        const layerName = layers.getLayerName(color, i, options.layerNaming);
        
        // 経路が取得できた場合のみ追加（空のレイヤーは除外）
        if (svgPaths) {
          layerItems.push({
            id: 'layer' + i,
            name: layerName,
            content: svgPaths,
            color: colorHex,
            visible: true
          });
        }
      }
      
      // レイヤーが生成されなかった場合はフォールバック
      if (layerItems.length === 0) {
        console.warn('レイヤーが生成されませんでした。フォールバック処理を実行します。');
        
        // Base64画像を埋め込んだSVGを作成
        ctx.putImageData(imageData, 0, 0);
        const dataURL = canvas.toDataURL('image/png', options.quality || 0.8);
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageData.width}" height="${imageData.height}">
          <image width="${imageData.width}" height="${imageData.height}" href="${dataURL}" />
        </svg>`;
      }
      
      // SVGを生成
      if (options.enableLayers && options.illustratorCompat) {
        return layers.createAICompatSVG(layerItems, imageData.width, imageData.height, options);
      } else if (options.enableLayers) {
        return layers.createLayeredSVG(layerItems, imageData.width, imageData.height);
      } else {
        // レイヤー無効時は単一SVGとして生成
        let paths = '';
        layerItems.forEach(function(layer) {
          paths += layer.content;
        });
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageData.width}" height="${imageData.height}" viewBox="0 0 ${imageData.width} ${imageData.height}">${paths}</svg>`;
      }
    } catch (error) {
      console.error('カラー処理中にエラーが発生しました:', error);
      
      // フォールバック: Base64画像を埋め込んだSVGを作成
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        
        const dataURL = canvas.toDataURL('image/png', options.quality || 0.8);
        
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${imageData.width}" height="${imageData.height}">
          <image width="${imageData.width}" height="${imageData.height}" href="${dataURL}" />
        </svg>`;
      } catch (fallbackError) {
        console.error('フォールバック処理中にエラーが発生しました:', fallbackError);
        return core.createFallbackSVG(imageData.width, imageData.height, 'SVG生成に失敗しました');
      }
    }
  }
  
  /**
   * Canvas要素からSVGデータを生成する
   * @param {HTMLCanvasElement} canvas - 変換するCanvas要素
   * @param {Object} options - 変換オプション
   * @param {Function} callback - 完了時のコールバック関数(error, svgData)
   */
  function canvasToSVG(canvas, options, callback) {
    try {
      options = Object.assign({}, defaultOptions, options);
      
      // 進捗報告の準備
      const reportProgress = function(stage, percent) {
        if (typeof options.progressCallback === 'function') {
          options.progressCallback(stage, percent);
        }
      };
      
      reportProgress('画像データ取得', 10);
      
      try {
        const imageData = core.getImageDataFromCanvas(canvas);
        
        reportProgress('SVG変換', 40);
        
        try {
          // カラーモードに応じた処理
          let svgData;
          if (options.colorMode === 'bw') {
            svgData = processBlackAndWhite(imageData, options);
          } else {
            svgData = processColor(imageData, options);
          }
          
          // SVGデータの整合性チェック
          if (!svgData || !svgData.includes('<svg') || !svgData.includes('</svg>')) {
            throw new Error('SVGデータの生成に失敗しました。不完全なSVGが生成されました。');
          }
          
          reportProgress('完了', 100);
          callback(null, svgData);
        } catch (error) {
          console.error('SVG変換エラー:', error);
          
          // フォールバックSVGを生成
          const fallbackSvg = core.createFallbackSVG(
            canvas.width, 
            canvas.height, 
            'エラー: ' + error.message
          );
          
          callback(error, fallbackSvg);
        }
      } catch (error) {
        console.error('画像データ取得エラー:', error);
        callback(error, null);
      }
    } catch (error) {
      console.error('予期せぬエラー:', error);
      callback(error, null);
    }
  }
  
  /**
   * SVGデータからレイヤー情報を抽出する
   * @param {string} svgData - SVGデータ文字列
   * @returns {Array} レイヤー情報の配列
   */
  function extractLayers(svgData) {
    if (!svgData) {
      console.error('SVGデータが指定されていません');
      return [];
    }
    
    try {
      return layers.extractLayers(svgData);
    } catch (error) {
      console.error('レイヤー抽出エラー:', error);
      return [];
    }
  }
  
  /**
   * レイヤーの表示/非表示を切り替える
   * @param {string} svgData - SVGデータ文字列
   * @param {string} layerId - レイヤーID
   * @param {boolean} visible - 表示状態
   * @returns {string} 更新されたSVGデータ
   */
  function setLayerVisibility(svgData, layerId, visible) {
    if (!svgData || !layerId) {
      console.error('必要なパラメータが不足しています');
      return svgData;
    }
    
    try {
      return layers.setLayerVisibility(svgData, layerId, visible);
    } catch (error) {
      console.error('レイヤー表示設定エラー:', error);
      return svgData;
    }
  }
  
  /**
   * レイヤーの色を変更する
   * @param {string} svgData - SVGデータ文字列
   * @param {string} layerId - レイヤーID
   * @param {string} color - 新しい色（16進数）
   * @returns {string} 更新されたSVGデータ
   */
  function updateLayerColor(svgData, layerId, color) {
    if (!svgData || !layerId || !color) {
      console.error('必要なパラメータが不足しています');
      return svgData;
    }
    
    try {
      return layers.updateLayerColor(svgData, layerId, color);
    } catch (error) {
      console.error('レイヤー色変更エラー:', error);
      return svgData;
    }
  }
  
  /**
   * SVGデータをダウンロードする
   * @param {string} svgData - SVGデータ文字列
   * @param {string} filename - ダウンロードするファイル名
   */
  function downloadSVG(svgData, filename) {
    if (!svgData) {
      console.error('SVGデータが指定されていません');
      return;
    }
    
    try {
      ui.downloadSVG(svgData, filename);
    } catch (error) {
      console.error('SVGダウンロードエラー:', error);
      ui.showError('SVGのダウンロードに失敗しました: ' + error.message, true);
    }
  }
  
  /**
   * SVGプレビューを更新する
   * @param {string} svgData - SVGデータ文字列
   * @param {HTMLElement} container - SVGを表示するコンテナ要素
   */
  function updateSVGPreview(svgData, container) {
    if (!svgData || !container) {
      console.error('必要なパラメータが不足しています');
      return;
    }
    
    try {
      container.innerHTML = svgData;
    } catch (error) {
      console.error('SVGプレビュー更新エラー:', error);
      container.innerHTML = `<div class="error-message">SVGの表示に失敗しました</div>`;
    }
  }
  
  /**
   * エラーメッセージを表示する
   * @param {string} message - エラーメッセージ
   * @param {boolean} alert - アラートを表示するかどうか
   */
  function showError(message, alert) {
    if (ui && ui.showError) {
      ui.showError(message, alert);
    } else {
      console.error('エラー:', message);
      if (alert) {
        window.alert(message);
      }
    }
  }
  
  // 公開API
  return {
    version: '3.5.1',
    defaultOptions: defaultOptions,
    fileToSVG: fileToSVG,
    canvasToSVG: canvasToSVG,
    extractLayers: extractLayers,
    setLayerVisibility: setLayerVisibility,
    updateLayerColor: updateLayerColor,
    downloadSVG: downloadSVG,
    updateSVGPreview: updateSVGPreview,
    showError: showError,
    
    // UI更新ヘルパー
    ui: {
      updateLayersList: ui && ui.updateLayersList ? ui.updateLayersList : null,
      updateSvgCodeDisplay: ui && ui.updateSvgCodeDisplay ? ui.updateSvgCodeDisplay : null,
      updateProgress: ui && ui.updateProgress ? ui.updateProgress : null,
      updateSettings: ui && ui.updateSettings ? ui.updateSettings : null
    },
    
    // ユーティリティ関数
    utils: {
      rgbToHex: utils && utils.rgbToHex ? utils.rgbToHex : null,
      hexToRgb: utils && utils.hexToRgb ? utils.hexToRgb : null,
      getFileExtension: utils && utils.getFileExtension ? utils.getFileExtension : null,
      createTimer: utils && utils.createTimer ? utils.createTimer : null
    }
  };
})(); 