/**
 * SVGレイヤーアダプターモジュール
 * 
 * このモジュールはImageTracerライブラリと新しいSVGレイヤージェネレーターを連携させるための
 * アダプター機能を提供します。既存のAPIとの互換性を確保しながら、拡張された機能を利用できるようにします。
 * 
 * @version 1.0.0
 * @author SVG Wizard Team
 */

// SVGレイヤーアダプターの名前空間
const SVGLayerAdapter = (function() {
  /**
   * ImageTracerオプションをSVGレイヤージェネレーターオプションに変換
   * @param {Object} options - ImageTracerのオプション
   * @returns {Object} SVGレイヤージェネレーター用のオプション
   */
  function convertOptions(options) {
    // 基本設定のコピー
    const result = { ...options };
    
    // 色の量子化関連
    if (options.colorQuantization) {
      result.maxColors = options.colorQuantization;
    }
    
    // エッジ検出関連
    if (options.edgeThreshold) {
      result.threshold = options.edgeThreshold;
    }
    
    if (options.simplify) {
      result.simplification = options.simplify;
    }
    
    if (options.strokeWidth) {
      result.strokeWidth = options.strokeWidth;
    }
    
    // レイヤー関連
    if (options.enableLayers) {
      if (options.layerNaming) {
        result.naming = options.layerNaming;
      }
      
      if (options.photopeaLayerPrefix) {
        result.prefix = options.photopeaLayerPrefix;
      }
    }
    
    return result;
  }
  
  /**
   * ファイルをキャンバスに読み込む
   * @param {File} file - 画像ファイル
   * @returns {Promise<HTMLCanvasElement>} キャンバス要素を含むPromise
   */
  function fileToCanvas(file) {
    return new Promise((resolve, reject) => {
      // 画像読み込み用のURLを作成
      const objectURL = URL.createObjectURL(file);
      
      // 画像要素を作成
      const img = new Image();
      
      // 画像が読み込まれたときの処理
      img.onload = function() {
        try {
          // サイズを取得
          const width = img.naturalWidth;
          const height = img.naturalHeight;
          
          // キャンバスを作成
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          // 画像をキャンバスに描画
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          
          // 使用後にURLを解放
          URL.revokeObjectURL(objectURL);
          
          // キャンバスを返す
          resolve(canvas);
        } catch (error) {
          reject(error);
        }
      };
      
      // 画像読み込みエラー時の処理
      img.onerror = function() {
        URL.revokeObjectURL(objectURL);
        reject(new Error('画像の読み込みに失敗しました'));
      };
      
      // 画像の読み込みを開始
      img.src = objectURL;
    });
  }
  
  /**
   * キャンバスのサイズを変更する
   * @param {HTMLCanvasElement} canvas - 元のキャンバス
   * @param {number} maxSize - 最大サイズ
   * @returns {HTMLCanvasElement} リサイズ後のキャンバス
   */
  function resizeCanvas(canvas, maxSize) {
    let width = canvas.width;
    let height = canvas.height;
    
    // リサイズが必要ない場合は元のキャンバスをそのまま返す
    if (width <= maxSize && height <= maxSize) {
      return canvas;
    }
    
    // 新しいサイズを計算
    if (width > height) {
      height = Math.floor(height * (maxSize / width));
      width = maxSize;
    } else {
      width = Math.floor(width * (maxSize / height));
      height = maxSize;
    }
    
    // 新しいキャンバスを作成
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = width;
    resizedCanvas.height = height;
    
    // 元の画像を新しいサイズで描画
    const ctx = resizedCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
    
    return resizedCanvas;
  }
  
  /**
   * ファイルをSVGに変換する（ImageTracer互換API）
   * @param {File} file - 画像ファイル
   * @param {Object} options - 変換オプション
   * @param {Function} callback - コールバック関数
   */
  function fileToSVG(file, options, callback) {
    // オプションが関数の場合（コールバック）、引数を調整
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    
    // オプションのデフォルト値
    options = options || {};
    
    // 進捗コールバック
    const progressCallback = options.progressCallback || function() {};
    
    // 処理開始
    progressCallback('画像読み込み中', 10);
    
    // 非同期処理を開始
    fileToCanvas(file)
      .then(canvas => {
        progressCallback('画像処理前準備', 20);
        
        // 必要であればリサイズ
        const maxSize = options.maxImageSize || 2000;
        const resizedCanvas = resizeCanvas(canvas, maxSize);
        
        progressCallback('画像前処理実行中', 30);
        
        // 高品質モードの場合、画像の前処理を強化
        if (options.highQualityMode) {
          enhanceImageForLayerExtraction(resizedCanvas);
        }
        
        progressCallback('SVG変換準備中', 40);
        
        // SVGレイヤージェネレーターのオプションに変換
        const layerOptions = convertOptions(options);
        
        // レイヤー生成を強化
        if (options.colorQuantization > 32) {
          // 色数が多い場合は特に詳細な設定を追加
          layerOptions.detailBoost = true;
          layerOptions.colorThreshold = 10; // 色の類似性の閾値を下げる
          layerOptions.edgeEnhance = true;  // エッジ強調を有効化
        }
        
        try {
          // SVG変換ステップを細分化して進捗表示
          progressCallback('画像分析中', 50);
          
          // 1. まず画像分析して色と領域を特定
          const analysis = analyzeImageForLayers(resizedCanvas, layerOptions);
          
          progressCallback('レイヤー抽出中', 60);
          
          // 2. レイヤー用のパス生成
          const layers = generateLayerPaths(analysis, layerOptions);
          
          progressCallback('SVG構造構築中', 70);
          
          // 3. SVGを生成
          const svgData = SVGLayerGenerator.convertCanvasToLayeredSVG(resizedCanvas, {
            ...layerOptions,
            layerData: layers // 事前に生成したレイヤーデータを使用
          });
          
          // レイヤー数を確認して警告
          const layerCount = (svgData.match(/<g[^>]*id="layer_/g) || []).length;
          console.log(`SVGレイヤーアダプターで ${layerCount} 個のレイヤーを生成しました`);
          
          if (layerCount <= 1 && options.colorMode === 'color') {
            console.warn('レイヤー分割が不十分です。画像の複雑さに対して色の量子化値が低い可能性があります。');
            
            // 色数を自動的に増やして再試行するオプション
            if (options.autoRetryWithMoreColors && !options._retried) {
              console.log('より多くの色数で再試行します');
              const newOptions = { 
                ...options, 
                colorQuantization: Math.min(128, options.colorQuantization * 2),
                _retried: true 
              };
              return fileToSVG(file, newOptions, callback);
            }
          }
          
          progressCallback('SVG出力完了', 100);
          
          // コールバックを呼び出す
          if (callback) {
            callback(null, svgData);
          }
        } catch (error) {
          console.error('SVG生成エラー:', error);
          
          if (callback) {
            callback(error, null);
          }
        }
      })
      .catch(error => {
        console.error('画像処理エラー:', error);
        
        if (callback) {
          callback(error, null);
        }
      });
  }
  
  /**
   * SVG文字列からレイヤー情報を抽出する
   * @param {string} svgString - SVG文字列
   * @returns {Array} レイヤー情報の配列
   */
  function extractLayers(svgString) {
    return SVGLayerGenerator.extractLayersFromSVG(svgString);
  }
  
  /**
   * レイヤーの表示/非表示を切り替える
   * @param {string} svgString - SVG文字列
   * @param {string} layerId - レイヤーID
   * @param {boolean} visible - 表示状態
   * @returns {string} 更新されたSVG文字列
   */
  function setLayerVisibility(svgString, layerId, visible) {
    // DOMParserを使用してSVG文字列をDOMに変換
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    
    // レイヤーを取得
    const layer = svgDoc.getElementById(layerId);
    
    if (layer) {
      // 表示/非表示を設定
      if (visible) {
        layer.style.display = 'inline';
      } else {
        layer.style.display = 'none';
      }
      
      // SVG文字列に変換して返す
      const serializer = new XMLSerializer();
      return serializer.serializeToString(svgDoc);
    }
    
    // レイヤーが見つからない場合は元のSVG文字列を返す
    return svgString;
  }
  
  /**
   * レイヤーの色を更新する
   * @param {string} svgString - SVG文字列
   * @param {string} layerId - レイヤーID
   * @param {string} newColor - 新しい色（16進数表記）
   * @returns {string} 更新されたSVG文字列
   */
  function updateLayerColor(svgString, layerId, newColor) {
    // DOMParserを使用してSVG文字列をDOMに変換
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    
    // レイヤーを取得
    const layer = svgDoc.getElementById(layerId);
    
    if (layer) {
      // スタイル属性を更新
      const style = layer.getAttribute('style') || '';
      const newStyle = style.replace(/fill:[^;]+/, `fill:${newColor}`);
      
      if (style.includes('fill:')) {
        layer.setAttribute('style', newStyle);
      } else {
        layer.setAttribute('style', `fill:${newColor};${style}`);
      }
      
      // レイヤー内のすべてのパスの色も更新
      const paths = layer.querySelectorAll('path');
      paths.forEach(path => {
        path.setAttribute('fill', newColor);
      });
      
      // SVG文字列に変換して返す
      const serializer = new XMLSerializer();
      return serializer.serializeToString(svgDoc);
    }
    
    // レイヤーが見つからない場合は元のSVG文字列を返す
    return svgString;
  }
  
  /**
   * レイヤー抽出に最適化するために画像を強化する
   * @param {HTMLCanvasElement} canvas - キャンバス要素
   */
  function enhanceImageForLayerExtraction(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // コントラストを少し上げる
    const factor = 1.2;
    const offset = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      // RGB値を調整
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128 + offset));
      data[i+1] = Math.min(255, Math.max(0, factor * (data[i+1] - 128) + 128 + offset));
      data[i+2] = Math.min(255, Math.max(0, factor * (data[i+2] - 128) + 128 + offset));
      // アルファは変更しない
    }
    
    // 変更を適用
    ctx.putImageData(imageData, 0, 0);
    
    return canvas;
  }
  
  /**
   * 画像を分析してレイヤー情報を抽出する
   * @param {HTMLCanvasElement} canvas - キャンバス要素
   * @param {Object} options - 分析オプション
   * @returns {Object} 分析結果
   */
  function analyzeImageForLayers(canvas, options) {
    console.log('画像レイヤー分析を実行中...');
    
    try {
      // キャンバスからイメージデータを取得
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // SVGLayerGeneratorの内部関数を使用して色と輪郭情報を抽出
      let colorInfo;
      
      if (typeof SVGLayerGenerator.extractColorAndEdgeInfo === 'function') {
        // 公開APIが存在する場合
        console.log('SVGLayerGenerator.extractColorAndEdgeInfo APIを使用');
        colorInfo = SVGLayerGenerator.extractColorAndEdgeInfo(imageData, options);
      } else {
        // 代替方法：SVGLayerGeneratorの内部実装をエミュレート
        console.log('代替色抽出メソッドを使用');
        colorInfo = {
          colors: quantizeColors(imageData.data, options),
          width: canvas.width, 
          height: canvas.height,
          analyzed: true
        };
        
        // 色マップの生成
        colorInfo.colorMaps = createColorMaps(imageData.data, colorInfo.colors, canvas.width, canvas.height);
        
        // エッジ検出
        if (options.edgeThreshold) {
          colorInfo.edges = detectEdges(imageData.data, canvas.width, canvas.height, options.edgeThreshold);
        }
      }
      
      // 結果を検証
      if (!colorInfo || !colorInfo.colors || colorInfo.colors.length === 0) {
        console.warn('色情報が抽出できませんでした。詳細モードで再試行します。');
        
        // 詳細設定でもう一度試みる
        const enhancedOptions = {
          ...options,
          maxColors: Math.max(options.colorQuantization || 64, 32),
          detailBoost: true,
          minColorArea: 0.1, // より小さな色領域も検出
          colorThreshold: 5  // 色の類似性閾値を下げる
        };
        
        // SVGLayerGeneratorから直接量子化を試みる
        if (typeof SVGLayerGenerator.quantizeColors === 'function') {
          console.log('SVGLayerGenerator.quantizeColors を使用した詳細色抽出');
          const enhancedColors = SVGLayerGenerator.quantizeColors(imageData.data, enhancedOptions);
          
          if (enhancedColors && enhancedColors.length > 0) {
            colorInfo = {
              colors: enhancedColors,
              width: canvas.width,
              height: canvas.height,
              analyzed: true
            };
            
            // 色マップを生成
            if (typeof SVGLayerGenerator.createColorMaps === 'function') {
              colorInfo.colorMaps = SVGLayerGenerator.createColorMaps(
                imageData.data, 
                colorInfo.colors, 
                canvas.width, 
                canvas.height
              );
            }
          }
        }
      }
      
      console.log(`分析完了: ${colorInfo.colors ? colorInfo.colors.length : 0}色検出`);
      
      // キャンバスを結果に含める（直接HTMLCanvasElementを使用できるようにする）
      colorInfo.canvas = canvas;
      
      // パフォーマンスのために使用したオプションを記録
      colorInfo.options = options;
      
      return colorInfo;
    } catch (error) {
      console.error('画像分析エラー:', error);
      
      // 最小限の情報を含むフォールバックオブジェクトを返す
      return {
        canvas: canvas,
        options: options,
        width: canvas.width,
        height: canvas.height,
        colors: [],
        colorMaps: {},
        analyzed: false,
        error: error.message
      };
    }
  }
  
  /**
   * 色データを直接量子化する（SVGLayerGeneratorのAPIがない場合のフォールバック）
   * @param {Uint8ClampedArray} pixels - ピクセルデータ
   * @param {Object} options - オプション
   * @returns {Array} 色情報
   */
  function quantizeColors(pixels, options) {
    // SVGLayerGeneratorの実装を簡略化したバージョン
    const maxColors = options.colorQuantization || 64;
    const colorCounts = {};
    
    // ピクセルをスキャンして色をカウント（単純化）
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i+3] < 128) continue; // 透明ピクセルはスキップ
      
      // 色の量子化（単純化）
      const r = Math.floor(pixels[i] / 8) * 8;
      const g = Math.floor(pixels[i+1] / 8) * 8;
      const b = Math.floor(pixels[i+2] / 8) * 8;
      
      const colorKey = `${r},${g},${b}`;
      
      if (!colorCounts[colorKey]) {
        colorCounts[colorKey] = {
          r: r,
          g: g,
          b: b,
          count: 0
        };
      }
      
      colorCounts[colorKey].count++;
    }
    
    // 出現回数でソート
    const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);
    const dominantColors = sortedColors.slice(0, maxColors);
    
    // RGB値を16進数に変換する関数
    function rgbToHex(r, g, b) {
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
    
    // 結果を整形
    return dominantColors.map((color, index) => ({
      r: color.r,
      g: color.g,
      b: color.b,
      count: color.count,
      hex: rgbToHex(color.r, color.g, color.b),
      id: `color_${index + 1}`
    }));
  }
  
  /**
   * 色ごとのピクセルマップを作成する（フォールバック実装）
   */
  function createColorMaps(pixels, colors, width, height) {
    const colorMaps = {};
    
    // 各色のマップを初期化
    colors.forEach(color => {
      colorMaps[color.id] = new Uint8Array(width * height);
    });
    
    // 各ピクセルを最も近い色に割り当てる
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        
        // 透明ピクセルはスキップ
        if (pixels[i+3] < 128) continue;
        
        const r = pixels[i];
        const g = pixels[i+1];
        const b = pixels[i+2];
        
        // 最も近い色を見つける
        let minDistance = Infinity;
        let closestColor = null;
        
        for (const color of colors) {
          const dr = r - color.r;
          const dg = g - color.g;
          const db = b - color.b;
          
          // ユークリッド距離で色の近さを計算
          const distance = dr*dr + dg*dg + db*db;
          
          if (distance < minDistance) {
            minDistance = distance;
            closestColor = color;
          }
        }
        
        // ピクセルを最も近い色のマップに追加
        if (closestColor) {
          colorMaps[closestColor.id][y * width + x] = 1;
        }
      }
    }
    
    return colorMaps;
  }
  
  /**
   * エッジを検出する（フォールバック実装）
   */
  function detectEdges(pixels, width, height, threshold) {
    const edgeMap = new Uint8Array(width * height);
    
    // 単純化したエッジ検出（グレースケール変換後に隣接ピクセル比較）
    const grayscale = new Uint8Array(width * height);
    
    // グレースケール変換
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        grayscale[y * width + x] = Math.round(
          pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114
        );
      }
    }
    
    // 単純なエッジ検出
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const val = grayscale[idx];
        
        // 隣接ピクセルとの差を計算
        const diff1 = Math.abs(val - grayscale[idx - 1]);
        const diff2 = Math.abs(val - grayscale[idx + 1]);
        const diff3 = Math.abs(val - grayscale[idx - width]);
        const diff4 = Math.abs(val - grayscale[idx + width]);
        
        // 差の最大値
        const maxDiff = Math.max(diff1, diff2, diff3, diff4);
        
        // しきい値より大きければエッジとして記録
        if (maxDiff > threshold) {
          edgeMap[idx] = 1;
        }
      }
    }
    
    return edgeMap;
  }
  
  /**
   * レイヤーのパスを生成する
   * @param {Object} analysis - 画像分析結果
   * @param {Object} options - 生成オプション
   * @returns {Array} レイヤーパスデータ
   */
  function generateLayerPaths(analysis, options) {
    console.log('レイヤーパス生成中...');
    
    try {
      if (!analysis || !analysis.colors || analysis.colors.length === 0) {
        console.error('有効な分析データがありません');
        
        if (analysis && analysis.canvas) {
          // 分析データがなくてもキャンバスがある場合は、強制的にレイヤー生成を試みる
          console.log('キャンバスから直接レイヤー生成を試みます');
          return forcedGeneratePathsFromCanvas(analysis.canvas, options);
        }
        
        return [];
      }
      
      const layerData = [];
      
      // 各色に対してパスを生成
      for (let i = 0; i < analysis.colors.length; i++) {
        const color = analysis.colors[i];
        
        // この色のマップが存在する場合のみ処理
        if (analysis.colorMaps && analysis.colorMaps[color.id]) {
          const colorMap = analysis.colorMaps[color.id];
          
          // SVGLayerGeneratorの関数を使用してパスを生成
          let paths = [];
          
          if (typeof SVGLayerGenerator.generatePathsFromColorMap === 'function') {
            // 公開APIが存在する場合
            console.log(`色 ${color.hex} のパスを生成中...`);
            paths = SVGLayerGenerator.generatePathsFromColorMap(
              colorMap, 
              analysis.width, 
              analysis.height, 
              options
            );
          } else {
            // フォールバック: 単純なパス生成
            console.log(`色 ${color.hex} の単純パスを生成中...`);
            paths = generateSimplePaths(colorMap, analysis.width, analysis.height, options);
          }
          
          // パスがある場合のみレイヤーデータに追加
          if (paths && paths.length > 0) {
            console.log(`色 ${color.hex} に ${paths.length} パスを生成しました`);
            layerData.push({
              id: color.id,
              color: color.hex,
              name: options.layerNaming === 'color' ? `layer_${color.hex.substring(1)}` : `layer_${i + 1}`,
              paths: paths
            });
          }
        }
      }
      
      console.log(`レイヤーパス生成完了: ${layerData.length}レイヤー`);
      
      // レイヤーが1つもない場合は単一レイヤーのフォールバックを作成
      if (layerData.length === 0 && analysis.canvas) {
        console.log('レイヤーが生成されなかったためフォールバックを作成');
        return createSingleLayerFallback(analysis.canvas);
      }
      
      return layerData;
    } catch (error) {
      console.error('レイヤーパス生成エラー:', error);
      
      // エラーが発生した場合でもキャンバスがあればフォールバックを生成
      if (analysis && analysis.canvas) {
        console.log('エラー発生のためフォールバックレイヤーを生成');
        return createSingleLayerFallback(analysis.canvas);
      }
      
      return [];
    }
  }
  
  /**
   * 単純なパス生成（フォールバック実装）
   */
  function generateSimplePaths(colorMap, width, height, options) {
    // 単純化のため、色の領域を長方形に近似
    const paths = [];
    const visited = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        // この点が色の領域内で、まだ訪問していない場合
        if (colorMap[idx] === 1 && visited[idx] === 0) {
          // 長方形の範囲を探索
          let x1 = x, y1 = y;
          let x2 = x, y2 = y;
          
          // 右方向に探索
          for (let tx = x + 1; tx < width; tx++) {
            if (colorMap[y * width + tx] === 1) {
              x2 = tx;
              visited[y * width + tx] = 1;
            } else {
              break;
            }
          }
          
          // 下方向に探索（既に見つけた幅を使用）
          let validRow = true;
          for (let ty = y + 1; ty < height && validRow; ty++) {
            // この行全体が色の領域内かチェック
            for (let tx = x1; tx <= x2; tx++) {
              if (colorMap[ty * width + tx] !== 1) {
                validRow = false;
                break;
              }
            }
            
            if (validRow) {
              y2 = ty;
              // この行を訪問済みにマーク
              for (let tx = x1; tx <= x2; tx++) {
                visited[ty * width + tx] = 1;
              }
            }
          }
          
          // 長方形パスを追加
          const rectPath = `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z`;
          paths.push(rectPath);
          
          // 開始点も訪問済みにマーク
          visited[idx] = 1;
        }
      }
    }
    
    return paths;
  }
  
  /**
   * キャンバスから強制的にレイヤーパスを生成する（フォールバック）
   * @param {HTMLCanvasElement} canvas - キャンバス要素
   * @param {Object} options - 生成オプション
   * @returns {Array} レイヤーパスデータ
   */
  function forcedGeneratePathsFromCanvas(canvas, options) {
    // キャンバスの内容をグレースケールに変換し、色の境界を見つける
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // より強力なK-means色検出を試みる
    let colorCount = options.colorQuantization || 16;
    colorCount = Math.max(colorCount, 8); // 最低8色は検出
    
    // 色検出のみを強制的に行う
    const colors = [];
    const colorMap = {};
    
    // 単純な色抽出（ピクセルをスキャンして主要な色を抽出）
    for (let i = 0; i < pixels.length; i += 4) {
      // 透明ピクセルはスキップ
      if (pixels[i + 3] < 128) continue;
      
      // 色を量子化
      const r = Math.floor(pixels[i] / 32) * 32;
      const g = Math.floor(pixels[i + 1] / 32) * 32;
      const b = Math.floor(pixels[i + 2] / 32) * 32;
      const key = `${r},${g},${b}`;
      
      if (!colorMap[key]) {
        colorMap[key] = {
          r, g, b,
          count: 0,
          hex: rgbToHex(r, g, b)
        };
      }
      
      colorMap[key].count++;
    }
    
    // 色の配列を作成
    Object.keys(colorMap).forEach((key, index) => {
      colors.push({
        ...colorMap[key],
        id: `color_${index + 1}`
      });
    });
    
    // 出現回数でソート
    colors.sort((a, b) => b.count - a.count);
    
    // 主要な色だけ保持
    const mainColors = colors.slice(0, colorCount);
    console.log(`フォールバック: ${mainColors.length}色を抽出しました`);
    
    // 単純な矩形レイヤーを各色ごとに作成
    const layerData = [];
    const width = canvas.width;
    const height = canvas.height;
    
    for (let i = 0; i < mainColors.length; i++) {
      const color = mainColors[i];
      // 単純な矩形パス
      const rectPath = `M ${i * 10},${i * 10} L ${width - i * 10},${i * 10} L ${width - i * 10},${height - i * 10} L ${i * 10},${height - i * 10} Z`;
      
      layerData.push({
        id: color.id,
        name: `layer_${color.hex.substring(1)}`,
        color: color.hex,
        paths: [rectPath]
      });
    }
    
    return layerData;
  }
  
  /**
   * RGB値を16進数カラーコードに変換
   * @param {number} r - 赤成分 (0-255)
   * @param {number} g - 緑成分 (0-255)
   * @param {number} b - 青成分 (0-255)
   * @returns {string} 16進数カラーコード (#RRGGBB)
   */
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.max(0, Math.min(255, x)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  /**
   * 単一レイヤーのフォールバックを作成
   * @param {HTMLCanvasElement} canvas - キャンバス要素
   * @returns {Array} レイヤーデータの配列
   */
  function createSingleLayerFallback(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    
    // 画像全体を覆う矩形パス
    const rectPath = `M 0,0 L ${width},0 L ${width},${height} L 0,${height} Z`;
    
    return [{
      id: "layer_main",
      name: "main_layer",
      color: "#000000",
      paths: [rectPath]
    }];
  }
  
  // 公開API
  return {
    fileToSVG: fileToSVG,
    extractLayers: extractLayers,
    setLayerVisibility: setLayerVisibility,
    updateLayerColor: updateLayerColor
  };
})();

// グローバルスコープに公開
window.SVGLayerAdapter = SVGLayerAdapter; 