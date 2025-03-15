/**
 * @module ImageTracer
 * @description SVG Wizard - 画像をSVGに変換するためのメインモジュール
 * @version 4.0.0
 * @license MIT
 * 
 * このファイルは、ImageTracerの主要APIを提供し、分割された各モジュール（コア、レイヤー、UI、ユーティリティ）を統合します。
 * 高度な物体認識とセグメンテーションによるレイヤー分離を実現し、各種グラフィックアプリケーションとの互換性を持ちます。
 * 
 * - 複数のカラーモード（カラー、白黒）をサポート
 * - 物体認識を用いた高度なレイヤー分離
 * - Photoshop、Photopea、Illustrator、PowerPoint互換SVG出力
 * - エッジ検出、物体セグメンテーションアルゴリズムを利用
 */

// グローバル名前空間にImageTracerを定義
window.ImageTracer = (function() {
  // グローバルオブジェクトのチェック関数
  function ensureObject(obj, name) {
    if (!obj) {
      console.warn(`${name}が見つかりません。基本的なフォールバック実装を使用します。`);
      return {};
    }
    return obj;
  }

  // 他のモジュールへの参照を保持
  let core = window.ImageTracerCore;
  let layers = window.ImageTracerLayers;
  let ui = window.ImageTracerUI;
  let utils = window.ImageTracerUtils;
  
  // 必須モジュールのフォールバック実装
  const fallbacks = {
    // コア機能のフォールバック
    core: {
      getImageDataFromCanvas: function(canvas) {
        console.warn('コアモジュールのフォールバック: getImageDataFromCanvas');
        try {
          const ctx = canvas.getContext('2d');
          return ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (error) {
          console.error('キャンバスからの画像データ取得に失敗しました:', error);
          throw new Error('キャンバスからの画像データ取得に失敗しました: ' + error.message);
        }
      },
      
      resizeImage: function(image, maxSize) {
        console.warn('コアモジュールのフォールバック: resizeImage');
        try {
          if (!maxSize) maxSize = 2000;
          
          const canvas = document.createElement('canvas');
          let width = image.naturalWidth;
          let height = image.naturalHeight;
          
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
          ctx.drawImage(image, 0, 0, width, height);
          return canvas;
        } catch (error) {
          console.error('画像のリサイズに失敗しました:', error);
          throw new Error('画像のリサイズに失敗しました: ' + error.message);
        }
      },
      
      createFallbackSVG: function(width, height, message) {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
          <rect width="100%" height="100%" fill="#f8f9fa" />
          <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#6c757d">${message || '変換に失敗しました'}</text>
        </svg>`;
      }
    }
  };
  
  // モジュールが正しく読み込まれているか確認し、必要に応じてフォールバックを設定
  if (!core) {
    console.error('ImageTracerCoreモジュールが見つかりません。基本的なフォールバック実装を使用します。');
    core = fallbacks.core;
  } else {
    // コアメソッドの欠落分をフォールバックで補完
    for (const method in fallbacks.core) {
      if (!core[method]) {
        console.warn(`ImageTracerCore.${method}が見つかりません。フォールバック実装を使用します。`);
        core[method] = fallbacks.core[method];
      }
    }
  }
  
  // 他のモジュールも同様に確認
  if (!layers) {
    console.error('ImageTracerLayersモジュールが見つかりません。一部の機能が制限されます。');
    layers = {};
  }
  
  if (!ui) {
    console.error('ImageTracerUIモジュールが見つかりません。UI関連機能が制限されます。');
    ui = {};
  }
  
  if (!utils) {
    console.error('ImageTracerUtilsモジュールが見つかりません。ユーティリティ機能が制限されます。');
    utils = {};
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
    enableLayers: true,       // レイヤー分離を有効化
    layerNaming: 'color',     // レイヤー命名方法（'color', 'index', 'auto'）
    illustratorCompat: true,  // イラストレーター互換出力
    universalLayerCompat: true, // 汎用レイヤー互換モードを有効にするかどうか
    photopeaCompat: true,     // Photopea互換出力を有効化
    
    // 物体認識オプション
    objectDetection: true,    // 物体認識を使用するかどうか
    edgeThreshold: 30,        // エッジ検出の閾値
    minSegmentSize: 100,      // 最小セグメントサイズ
    maxSegments: 24,          // 最大セグメント数
    
    // パフォーマンスオプション
    maxImageSize: 2000,      // 最大画像サイズ
    timeout: 60000,          // タイムアウト（ミリ秒）
    progressCallback: null,  // 進捗コールバック関数
    quality: 0.8             // 画像品質（0.0～1.0）
  };
  
  /**
   * ファイルからSVGを生成します
   * @param {File} file - 変換する画像ファイル
   * @param {Object} options - 変換オプション
   * @param {Function} callback - コールバック関数(error, svgData)
   */
  function fileToSVG(file, options, callback) {
    try {
      // オプションのデフォルト値を設定
      options = Object.assign({}, defaultOptions, options);
      
      // 進捗報告の準備
      const reportProgress = function(stage, percent) {
        if (typeof options.progressCallback === 'function') {
          options.progressCallback(stage, percent);
        }
      };
      
      console.log('ファイル変換開始:', file.name, file.type);
      reportProgress('画像の読み込み', 5);
      
      // グローバル変数に現在のファイルを設定
      window.currentImageFile = file;
      
      // utils.createImageFromFileが存在するか確認
      if (!utils.createImageFromFile) {
        console.error('utils.createImageFromFileが見つかりません');
        
        // 代替手段として、標準的な方法で画像を読み込む
        const image = new Image();
        const objectURL = URL.createObjectURL(file);
        
        image.onload = function() {
          try {
            URL.revokeObjectURL(objectURL);
            processLoadedImage(image);
          } catch (err) {
            handleProcessError(err);
          }
        };
        
        image.onerror = function(error) {
          URL.revokeObjectURL(objectURL);
          handleProcessError(new Error('画像の読み込みに失敗しました'));
        };
        
        image.src = objectURL;
      } else {
        // 通常の画像読み込み
        utils.createImageFromFile(file)
          .then(processLoadedImage)
          .catch(handleProcessError);
      }
      
      // 画像が読み込まれた後の処理
      function processLoadedImage(image) {
        reportProgress('画像の前処理', 20);
        
        try {
          // 画像サイズを確認して必要ならリサイズ
          const maxSize = options.maxImageSize || 2000;
          let canvas;
          
          // core.resizeImageが存在するか確認
          if (!core.resizeImage) {
            console.warn('core.resizeImageが見つかりません。代替実装を使用します。');
            
            // 代替リサイズ実装
            canvas = document.createElement('canvas');
            let width = image.naturalWidth;
            let height = image.naturalHeight;
            
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
            ctx.drawImage(image, 0, 0, width, height);
          } else if (image.naturalWidth > maxSize || image.naturalHeight > maxSize) {
            console.log(`画像を最大サイズ ${maxSize}px にリサイズします。元サイズ: ${image.naturalWidth}x${image.naturalHeight}`);
            reportProgress('画像のリサイズ中', 25);
            canvas = core.resizeImage(image, maxSize);
          } else {
            // リサイズ不要の場合は元のサイズでキャンバスを作成
            canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);
          }
          
          // canvasToSVG関数でSVG生成
          reportProgress('SVGに変換中', 30);
          
          // Canvas要素と現在のオプションを使ってSVG変換
          canvasToSVG(canvas, options, function(error, svgData) {
            if (error) {
              console.error('SVG変換エラー:', error);
              
              // 何らかのSVGを返すために、基本的なエラーSVGを生成
              try {
                reportProgress('フォールバック処理実行中', 80);
                let errorSvg;
                
                // core.createFallbackSVGが存在するか確認
                if (core.createFallbackSVG) {
                  errorSvg = core.createFallbackSVG(
                    canvas.width, 
                    canvas.height, 
                    'エラー: ' + (error.message || '変換に失敗しました')
                  );
                } else {
                  // 基本的なSVGを生成
                  errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
                    <rect width="100%" height="100%" fill="#f8f9fa" />
                    <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#6c757d">エラー: ${error.message || '変換に失敗しました'}</text>
                  </svg>`;
                }
                
                callback(error, errorSvg);
              } catch (fallbackError) {
                // フォールバックすら失敗した場合
                reportProgress('処理失敗', 100);
                callback(error, null);
              }
            } else {
              reportProgress('SVG生成完了', 100);
              callback(null, svgData);
            }
          });
        } catch (processError) {
          handleProcessError(processError);
        }
      }
      
      // エラー処理関数
      function handleProcessError(error) {
        console.error('画像処理エラー:', error);
        reportProgress('画像処理エラー', 100);
        
        // 基本的なエラーSVGを生成して返す
        try {
          let errorSvg;
          
          if (core.createFallbackSVG) {
            errorSvg = core.createFallbackSVG(
              400, 
              300, 
              'エラー: ' + (error.message || '画像処理に失敗しました')
            );
          } else {
            errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
              <rect width="100%" height="100%" fill="#f8f9fa" />
              <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#6c757d">エラー: ${error.message || '画像処理に失敗しました'}</text>
            </svg>`;
          }
          
          callback(error, errorSvg);
        } catch (fallbackError) {
          callback(error, null);
        }
      }
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
   * カラーモードでSVG変換を行う（高度なセグメンテーション対応）
   * @param {ImageData} imageData - 処理する画像データ
   * @param {Object} options - 変換オプション
   * @returns {string} SVGデータ
   * @private
   */
  function processColor(imageData, options) {
    const segmentationEnabled = options.objectDetection === true && options.enableLayers === true;
    
    if (segmentationEnabled) {
      try {
        // 高度なセグメンテーションを使用
        const result = core.generateObjectBasedSVG(imageData, {
          edgeThreshold: options.edgeThreshold || 30,
          minSegmentSize: options.minSegmentSize || 100,
          maxSegments: options.maxSegments || 24,
          simplify: options.simplify || 0.5
        });
        
        return result.svgData;
      } catch (error) {
        console.error('セグメンテーションエラー:', error);
        // 標準的な色処理にフォールバック
      }
    }
    
    // 標準的な色処理
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
          const layerId = `layer_${i}`;
          
          // Photopea互換属性
          const photopeaAttrs = options.photopeaCompat ? 
            core.createPhotopeaLayerAttributes(layerId, layerName, {r: color[0], g: color[1], b: color[2]}) : {};
          
          layerItems.push({
            id: layerId,
            name: layerName,
            content: svgPaths,
            pathData: svgPaths,
            color: colorHex,
            visible: true,
            photopeaAttributes: photopeaAttrs
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
      if (options.enableLayers) {
        if (options.photopeaCompat) {
          return core.generateLayeredSVG(layerItems, imageData.width, imageData.height, options);
        } else if (options.universalLayerCompat) {
          return core.generateLayeredSVG(layerItems, imageData.width, imageData.height, options);
        } else if (options.illustratorCompat) {
          return layers.createAICompatSVG(layerItems, imageData.width, imageData.height, options);
        } else {
          return layers.createLayeredSVG(layerItems, imageData.width, imageData.height);
        }
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
        // core.getImageDataFromCanvasが存在するか確認
        let imageData;
        
        if (!core.getImageDataFromCanvas) {
          console.warn('core.getImageDataFromCanvasが見つかりません。代替実装を使用します。');
          
          try {
            // 代替実装
            const ctx = canvas.getContext('2d');
            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          } catch (getDataError) {
            throw new Error('画像データの取得に失敗しました: ' + getDataError.message);
          }
        } else {
          // 通常の実装
          imageData = core.getImageDataFromCanvas(canvas);
        }
        
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
          const fallbackSvg = generateFallbackSVG(
            canvas.width, 
            canvas.height, 
            'エラー: ' + error.message
          );
          
          callback(error, fallbackSvg);
        }
      } catch (error) {
        console.error('画像データ取得エラー:', error);
        
        // フォールバックSVGを生成
        const fallbackSvg = generateFallbackSVG(
          canvas.width, 
          canvas.height, 
          'エラー: 画像データの取得に失敗しました'
        );
        
        callback(error, fallbackSvg);
      }
    } catch (error) {
      console.error('予期せぬエラー:', error);
      
      // 基本的なエラーSVGを生成
      try {
        const errorSvg = generateFallbackSVG(400, 300, 'エラー: ' + error.message);
        callback(error, errorSvg);
      } catch (fallbackError) {
        callback(error, null);
      }
    }
  }
  
  /**
   * フォールバックSVGの生成 (内部ユーティリティ関数)
   * @private
   */
  function generateFallbackSVG(width, height, message) {
    if (core.createFallbackSVG) {
      return core.createFallbackSVG(width, height, message);
    } else {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="#f8f9fa" />
        <text x="50%" y="50%" font-family="sans-serif" font-size="14" text-anchor="middle" fill="#6c757d">${message || '変換に失敗しました'}</text>
      </svg>`;
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
      // DOMパーサーを使用してSVGを解析
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgData, 'image/svg+xml');
      
      const layers = [];
      
      // SVGグループ要素をレイヤーとして処理
      const groups = doc.querySelectorAll('g');
      
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        
        // ルートグループはスキップ
        if (group.getAttribute('data-photopea-root') === 'true') {
          continue;
        }
        
        // レイヤーID
        const id = group.getAttribute('id') || `layer_${i}`;
        
        // レイヤー名を取得（様々な属性をチェック）
        let name = group.getAttribute('data-name') || 
                  group.getAttribute('inkscape:label') || 
                  `レイヤー ${i + 1}`;
        
        // レイヤーの色
        let color = group.getAttribute('data-color');
        
        // 色が指定されていない場合はパスから取得
        if (!color) {
          const paths = group.querySelectorAll('path');
          if (paths.length > 0) {
            color = paths[0].getAttribute('fill');
          }
        }
        
        if (!color) {
          color = '#000000';
        }
        
        // 表示/非表示状態
        const style = group.getAttribute('style') || '';
        const visible = !style.includes('display:none');
        
        // Photopea特有の属性を収集
        const photopeaAttributes = {};
        const dataAttributes = Array.from(group.attributes)
          .filter(attr => attr.name.startsWith('data-'));
        
        dataAttributes.forEach(attr => {
          photopeaAttributes[attr.name] = attr.value;
        });
        
        // レイヤー情報を追加
        layers.push({
          id: id,
          name: name,
          color: color,
          visible: visible,
          photopeaAttributes: photopeaAttributes
        });
      }
      
      return layers;
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
    version: '4.0.0',
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