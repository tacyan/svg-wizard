/**
 * ImageTracer.js
 * 
 * 画像をSVGパスに変換するためのライブラリです。
 * Potraceライブラリを利用して高品質なベクター変換を行います。
 * 
 * このライブラリは画像のエッジを検出し、ベクターパスを生成します。
 * クライアントサイドで完全に動作し、サーバーに画像データを送信しません。
 * 
 * 特徴：
 * - レイヤー分割機能（色ごとの独立レイヤー）
 * - 個別レイヤーの色編集機能
 * - 高品質ベクター変換
 * 
 * サポートされている画像形式：
 * - JPEG/JPG
 * - PNG
 * - GIF
 * - WebP
 * 
 * @version 3.0.0
 */

const ImageTracer = {
  /**
   * 画像オブジェクトからSVGを生成する
   * @param {HTMLImageElement} imageObj - 変換対象の画像要素
   * @param {Object} options - 変換オプション
   * @param {Function} progressCallback - 進捗を通知するコールバック関数
   * @returns {Promise<Object>} SVG文字列とレイヤー情報を含むオブジェクトを解決するPromise
   */
  imageToSVG: async function(imageObj, options = {}, progressCallback = null) {
    return new Promise((resolve, reject) => {
      // デフォルトオプションの設定
      const defaultOptions = {
        threshold: 128,
        colorMode: 'color', // 'color' または 'bw'（白黒）
        simplify: 0.5, // パスの単純化（0〜1）
        scale: 1,
        outputFormat: 'svg', // 'svg' または 'path'（パスデータのみ）、'layered'（レイヤー情報付き）
        maxImageSize: 2000, // 処理する最大サイズ（幅または高さ）
        colorQuantization: 16, // カラーモードで使用する最大色数（2-256）
        blurRadius: 0, // 前処理のブラー強度（0-5）
        strokeWidth: 0, // SVGパスのストローク幅（0=塗りつぶし）
        enableLayers: true, // レイヤー機能の有効化
        layerNaming: 'color', // レイヤー名の付け方（'color'=色、'index'=インデックス）
        colorPalette: null // 指定されたカラーパレット（nullの場合は自動生成）
      };
      
      const opts = { ...defaultOptions, ...options };
      
      // カラー量子化の値を制限（2-256）
      opts.colorQuantization = Math.max(2, Math.min(256, opts.colorQuantization));
      
      // 進捗コールバックがなければ空の関数を設定
      const updateProgress = progressCallback || (() => {});
      
      try {
        // 初期進捗の通知
        updateProgress(5);
        
        // 画像サイズの制限（大きすぎる画像はリサイズ）
        let width = imageObj.width * opts.scale;
        let height = imageObj.height * opts.scale;
        
        // 画像が大きすぎる場合はリサイズ
        const maxSize = opts.maxImageSize;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
          console.warn(`画像サイズが大きいため、${width}x${height}にリサイズして処理します。`);
        }
        
        // Canvasの作成と画像の描画
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(imageObj, 0, 0, width, height);
        
        updateProgress(15);
        
        // 前処理（オプションでブラー処理を適用）
        if (opts.blurRadius > 0) {
          this._applyBlur(ctx, width, height, opts.blurRadius);
        }
        
        // 画像データの取得
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // カラーモードに応じた処理
        if (opts.colorMode === 'bw') {
          // 白黒モードの場合はPotraceを使用
          this._processBWImage(imageData, opts, updateProgress)
            .then(svgData => {
              resolve({
                svg: svgData,
                layers: [{
                  id: 'layer_bw',
                  name: '白黒レイヤー',
                  color: '#000000',
                  visible: true,
                  paths: svgData.match(/<path[^>]*>/g) || []
                }]
              });
            })
            .catch(error => {
              reject(error);
            });
        } else {
          // カラーモードの場合はカラー画像処理
          this._processColorImage(imageData, opts, updateProgress)
            .then(result => {
              resolve(result);
            })
            .catch(error => {
              reject(error);
            });
        }
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 画像にブラーをかける前処理
   * @param {CanvasRenderingContext2D} ctx - キャンバスコンテキスト
   * @param {Number} width - 画像の幅
   * @param {Number} height - 画像の高さ
   * @param {Number} radius - ブラー半径（0-5）
   * @private
   */
  _applyBlur: function(ctx, width, height, radius) {
    // 簡易ボックスブラーの実装
    const iterations = Math.min(3, Math.max(1, Math.floor(radius)));
    const blurRadius = Math.min(5, Math.max(1, Math.floor(radius)));
    
    for (let i = 0; i < iterations; i++) {
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const result = new Uint8ClampedArray(data.length);
      
      // 水平方向のブラー
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, a = 0, count = 0;
          
          for (let dx = -blurRadius; dx <= blurRadius; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx));
            const i = (y * width + nx) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            a += data[i + 3];
            count++;
          }
          
          const resultIndex = (y * width + x) * 4;
          result[resultIndex] = r / count;
          result[resultIndex + 1] = g / count;
          result[resultIndex + 2] = b / count;
          result[resultIndex + 3] = a / count;
        }
      }
      
      // 結果をキャンバスに戻す
      const newImageData = new ImageData(result, width, height);
      ctx.putImageData(newImageData, 0, 0);
    }
  },
  
  /**
   * 白黒画像の処理（Potraceを使用）
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @param {Function} updateProgress - 進捗更新関数
   * @returns {Promise<String>} SVG文字列
   * @private
   */
  _processBWImage: function(imageData, options, updateProgress) {
    return new Promise((resolve, reject) => {
      try {
        updateProgress(20);
        
        // Potraceライブラリのチェック - より堅牢な検出方法と読み込み状態フラグの確認
        if (typeof window.Potrace === 'undefined' || window.potraceLoaded === false) {
          console.warn('Potraceライブラリが利用できません。代替処理を使用します。');
          // ライブラリが利用できない場合は、代替として簡易的な白黒SVGを生成
          return this._fallbackBWProcess(imageData, options, updateProgress)
            .then(svgData => resolve(svgData));
        }
        
        // Potraceインスタンスの作成
        const potrace = window.Potrace.Potrace.getInstance();
        
        // Potraceのパラメータ設定
        potrace.setParameters({
          threshold: options.threshold,
          turdSize: 2,
          alphaMax: 1.0,
          optCurve: true,
          optTolerance: 0.2,
          turnPolicy: window.Potrace.Potrace.TURNPOLICY_MINORITY
        });
        
        updateProgress(30);
        
        // 画像データをPotraceに設定
        potrace.loadImageFromInstance(imageData, imageData.width, imageData.height);
        
        updateProgress(50);
        
        // ポトレースの実行（非同期）
        const processingPromise = new Promise(resolve => {
          setTimeout(() => {
            potrace.process(() => {
              resolve();
            });
          }, 0);
        });
        
        processingPromise.then(() => {
          updateProgress(90);
          
          // SVGデータの取得
          let svgData = potrace.getSVG(1.0, options.simplify);
          
          // レイヤー機能が有効な場合、グループ化する
          if (options.enableLayers) {
            // SVGの開始タグと終了タグを分離
            const svgStart = svgData.substring(0, svgData.indexOf('>') + 1);
            const svgEnd = '</svg>';
            const svgContent = svgData.substring(svgData.indexOf('>') + 1, svgData.lastIndexOf('</svg>'));
            
            // グループタグでパスを囲む
            const layerId = 'layer_bw';
            const layerContent = `<g id="${layerId}" data-name="白黒レイヤー" data-color="#000000" data-editable="true">${svgContent}</g>`;
            
            svgData = svgStart + layerContent + svgEnd;
          }
          
          // ストローク幅が指定されている場合はスタイルを追加
          if (options.strokeWidth > 0) {
            svgData = this._addStrokeToSVG(svgData, options.strokeWidth);
          }
          
          updateProgress(100);
          resolve(svgData);
        });
      } catch (error) {
        console.error('Potrace処理エラー:', error);
        // エラーが発生した場合は代替処理を試みる
        this._fallbackBWProcess(imageData, options, updateProgress)
          .then(svgData => resolve(svgData))
          .catch(err => reject(err));
      }
    });
  },
  
  /**
   * SVGにストロークスタイルを追加する
   * @param {String} svgData - 元のSVGデータ
   * @param {Number} strokeWidth - ストローク幅
   * @returns {String} 修正されたSVG
   * @private
   */
  _addStrokeToSVG: function(svgData, strokeWidth) {
    // パス要素にストロークスタイルを追加
    return svgData.replace(/<path/g, `<path stroke="black" stroke-width="${strokeWidth}" fill="none"`);
  },
  
  /**
   * Potraceが利用できない場合の代替白黒処理
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @param {Function} updateProgress - 進捗更新関数
   * @returns {Promise<String>} SVG文字列
   * @private
   */
  _fallbackBWProcess: function(imageData, options, updateProgress) {
    return new Promise((resolve) => {
      try {
        updateProgress(30);
        
        // 簡易実装：白黒画像の場合は閾値処理を行いグレースケール化
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
        
        // 閾値処理（白黒化）
        const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = newImageData.data;
        const threshold = options.threshold;
        
        for (let i = 0; i < data.length; i += 4) {
          // グレースケール値の計算
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // 閾値と比較して白か黒にする
          const value = gray >= threshold ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = value;
        }
        
        ctx.putImageData(newImageData, 0, 0);
        
        updateProgress(60);
        
        // 画質を適切に設定して変換
        const imageQuality = 0.8; // 画質設定（0.0〜1.0）
        const base64Image = canvas.toDataURL('image/png', imageQuality);
        
        updateProgress(90);
        
        // SVGの生成（適切にエスケープ）
        const svg = this._createSVGWithImage(imageData.width, imageData.height, base64Image);
        
        updateProgress(100);
        resolve(svg);
      } catch (error) {
        console.error('白黒変換エラー:', error);
        // エラーが発生した場合でも最低限のSVGを返す
        const svg = this._createEmptySVG(imageData.width, imageData.height);
        resolve(svg);
      }
    });
  },
  
  /**
   * カラー画像の処理
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @param {Function} updateProgress - 進捗更新関数
   * @returns {Promise<Object>} SVGデータとレイヤー情報
   * @private
   */
  _processColorImage: function(imageData, options, updateProgress) {
    return new Promise((resolve, reject) => {
      try {
        updateProgress(20);
        
        // Potraceライブラリの確認
        if (typeof window.Potrace === 'undefined' || window.potraceLoaded === false) {
          console.warn('Potraceライブラリが利用できません。代替処理を使用します。');
          // 代替処理として単純な画像埋め込みを使用
          return this._createSimpleColorSVG(imageData, options, updateProgress)
            .then(svgData => resolve({
              svg: svgData,
              layers: [{
                id: 'layer_image',
                name: '画像レイヤー',
                type: 'image',
                visible: true
              }]
            }));
        }
        
        // 色の量子化とレイヤー分解
        if (options.enableLayers) {
          // レイヤー対応の処理方法
          this._processWithLayers(imageData, options, updateProgress)
            .then(result => {
              updateProgress(100);
              resolve(result);
            })
            .catch(error => {
              console.error('レイヤー処理エラー:', error);
              // エラー時は代替処理
              this._createSimpleColorSVG(imageData, options, updateProgress)
                .then(svgData => resolve({
                  svg: svgData,
                  layers: [{
                    id: 'layer_image',
                    name: '画像レイヤー',
                    type: 'image',
                    visible: true
                  }]
                }));
            });
        } else {
          // 従来の処理方法
          this._processWithColorQuantization(imageData, options, updateProgress)
            .then(svgData => {
              updateProgress(100);
              resolve({
                svg: svgData,
                layers: [{
                  id: 'layer_color',
                  name: 'カラーレイヤー',
                  type: 'color',
                  visible: true
                }]
              });
            })
            .catch(error => {
              console.error('カラー処理エラー:', error);
              // エラーが発生した場合は代替処理に切り替え
              this._createSimpleColorSVG(imageData, options, updateProgress)
                .then(svgData => resolve({
                  svg: svgData,
                  layers: [{
                    id: 'layer_image',
                    name: '画像レイヤー',
                    type: 'image',
                    visible: true
                  }]
                }));
            });
        }
        
      } catch (error) {
        console.error('カラー変換エラー:', error);
        reject(error);
      }
    });
  },
  
  /**
   * レイヤー対応の色画像処理
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @param {Function} updateProgress - 進捗更新関数
   * @returns {Promise<Object>} SVG文字列とレイヤー情報
   * @private
   */
  _processWithLayers: function(imageData, options, updateProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        // 色の量子化（最大色数を制限）
        updateProgress(30);
        const { palette, indexedPixels } = this._quantizeColors(imageData, options.colorQuantization);
        
        updateProgress(40);
        
        // SVG生成用の準備
        const width = imageData.width;
        const height = imageData.height;
        
        // SVGのヘッダーを作成
        let svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-layered="true">\n`;
        
        // レイヤー情報を格納する配列
        const layers = [];
        
        // パレットの各色に対してレイヤーを作成
        const totalColors = palette.length;
        for (let colorIndex = 0; colorIndex < totalColors; colorIndex++) {
          updateProgress(40 + (50 * colorIndex / totalColors));
          
          // 現在の色のマスクを作成
          const colorMask = this._createColorMask(indexedPixels, colorIndex, width, height);
          
          // Potraceで処理
          potrace.setParameters({ threshold: 128 });
          potrace.loadImageFromInstance(colorMask, width, height);
          
          await new Promise(resolve => {
            potrace.process(() => {
              resolve();
            });
          });
          
          // 色のRGBを16進数表現に変換
          const color = palette[colorIndex];
          const hexColor = this._rgbToHex(color[0], color[1], color[2]);
          
          // レイヤーIDとレイヤー名の生成
          const layerId = `layer_${colorIndex}`;
          const layerName = options.layerNaming === 'color' ? 
                         `${hexColor}レイヤー` : 
                         `レイヤー${colorIndex + 1}`;
          
          // SVGパスデータを取得
          const pathData = potrace.getPathTag(options.simplify, { fill: hexColor, "fill-opacity": 1.0 });
          
          // パスにレイヤー情報を付与して追加
          const layerContent = `<g id="${layerId}" data-name="${layerName}" data-color="${hexColor}" data-editable="true">${pathData}</g>\n`;
          svgData += layerContent;
          
          // レイヤー情報を保存
          layers.push({
            id: layerId,
            name: layerName,
            color: hexColor,
            visible: true,
            index: colorIndex
          });
        }
        
        // SVGを閉じる
        svgData += "</svg>";
        
        updateProgress(95);
        resolve({
          svg: svgData,
          layers: layers
        });
        
      } catch (error) {
        console.error('レイヤー処理エラー:', error);
        reject(error);
      }
    });
  },
  
  /**
   * 色の量子化を使用したカラー画像処理
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @param {Function} updateProgress - 進捗更新関数
   * @returns {Promise<String>} SVG文字列
   * @private
   */
  _processWithColorQuantization: function(imageData, options, updateProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        // 色の量子化（最大色数を制限）
        updateProgress(30);
        const { palette, indexedPixels } = this._quantizeColors(imageData, options.colorQuantization);
        
        updateProgress(40);
        
        // SVG生成用の準備
        const width = imageData.width;
        const height = imageData.height;
        
        // SVGのヘッダーを作成
        let svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
        
        // 各色のレイヤーを処理
        const potrace = window.Potrace.Potrace.getInstance();
        
        // Potraceのパラメータ設定
        potrace.setParameters({
          turdSize: 2,
          alphaMax: 1.0,
          optCurve: true,
          optTolerance: 0.2,
          turnPolicy: window.Potrace.Potrace.TURNPOLICY_MINORITY
        });
        
        // パレットの各色に対してレイヤーを作成
        const totalColors = palette.length;
        for (let colorIndex = 0; colorIndex < totalColors; colorIndex++) {
          updateProgress(40 + (50 * colorIndex / totalColors));
          
          // 現在の色のマスクを作成
          const colorMask = this._createColorMask(indexedPixels, colorIndex, width, height);
          
          // Potraceで処理
          potrace.setParameters({ threshold: 128 });
          potrace.loadImageFromInstance(colorMask, width, height);
          
          await new Promise(resolve => {
            potrace.process(() => {
              resolve();
            });
          });
          
          // 色のRGBを16進数表現に変換
          const color = palette[colorIndex];
          const hexColor = this._rgbToHex(color[0], color[1], color[2]);
          
          // この色のパスを取得してSVGに追加
          const pathData = potrace.getPathTag(options.simplify, { fill: hexColor, "fill-opacity": 1.0 });
          svgData += pathData + "\n";
        }
        
        // SVGを閉じる
        svgData += "</svg>";
        
        updateProgress(95);
        resolve(svgData);
        
      } catch (error) {
        console.error('色量子化処理エラー:', error);
        reject(error);
      }
    });
  },
  
  /**
   * 色の量子化を行う
   * @param {ImageData} imageData - 画像データ
   * @param {Number} maxColors - 最大色数
   * @returns {Object} パレットとインデックス付きピクセル
   * @private
   */
  _quantizeColors: function(imageData, maxColors) {
    // メディアンカット法による簡易的な色の量子化

    // 画像データをRGBの配列に変換
    const pixels = [];
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }
    
    // 色空間を分割するための再帰関数
    const splitColorSpace = (pixels, depth, maxDepth) => {
      if (depth >= maxDepth || pixels.length === 0) {
        // 平均色を計算
        let r = 0, g = 0, b = 0;
        for (const pixel of pixels) {
          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
        }
        
        const count = Math.max(1, pixels.length);
        return [[Math.round(r / count), Math.round(g / count), Math.round(b / count)]];
      }
      
      // 最大の分散を持つチャンネルを見つける
      let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
      for (const pixel of pixels) {
        rMin = Math.min(rMin, pixel[0]);
        rMax = Math.max(rMax, pixel[0]);
        gMin = Math.min(gMin, pixel[1]);
        gMax = Math.max(gMax, pixel[1]);
        bMin = Math.min(bMin, pixel[2]);
        bMax = Math.max(bMax, pixel[2]);
      }
      
      const rRange = rMax - rMin;
      const gRange = gMax - gMin;
      const bRange = bMax - bMin;
      
      let channel;
      if (rRange >= gRange && rRange >= bRange) {
        channel = 0; // R
      } else if (gRange >= rRange && gRange >= bRange) {
        channel = 1; // G
      } else {
        channel = 2; // B
      }
      
      // ピクセルを選択したチャンネルでソート
      pixels.sort((a, b) => a[channel] - b[channel]);
      
      // 中央で分割
      const mid = Math.floor(pixels.length / 2);
      const set1 = pixels.slice(0, mid);
      const set2 = pixels.slice(mid);
      
      // 再帰的に分割を続ける
      return [
        ...splitColorSpace(set1, depth + 1, maxDepth),
        ...splitColorSpace(set2, depth + 1, maxDepth)
      ];
    };
    
    // 最大色数に基づいて必要な深さを計算
    const maxDepth = Math.ceil(Math.log2(maxColors));
    
    // 色空間を分割
    const palette = splitColorSpace(pixels, 0, maxDepth);
    
    // 各ピクセルに最も近い色のインデックスを割り当て
    const indexedPixels = new Uint8Array(pixels.length);
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      let bestIndex = 0;
      let bestDistance = Number.MAX_VALUE;
      
      for (let j = 0; j < palette.length; j++) {
        const color = palette[j];
        // ユークリッド距離
        const distance = 
          Math.pow(pixel[0] - color[0], 2) + 
          Math.pow(pixel[1] - color[1], 2) + 
          Math.pow(pixel[2] - color[2], 2);
        
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = j;
        }
      }
      
      indexedPixels[i] = bestIndex;
    }
    
    return { palette, indexedPixels };
  },
  
  /**
   * 特定の色のマスク画像を作成
   * @param {Uint8Array} indexedPixels - 色インデックス付きピクセル
   * @param {Number} colorIndex - 対象の色インデックス
   * @param {Number} width - 画像の幅
   * @param {Number} height - 画像の高さ
   * @returns {ImageData} 二値マスク画像
   * @private
   */
  _createColorMask: function(indexedPixels, colorIndex, width, height) {
    const maskData = new Uint8ClampedArray(width * height * 4);
    
    for (let i = 0; i < indexedPixels.length; i++) {
      const baseIndex = i * 4;
      const value = indexedPixels[i] === colorIndex ? 0 : 255; // マスクは黒（0）が対象領域
      
      maskData[baseIndex] = value;
      maskData[baseIndex + 1] = value;
      maskData[baseIndex + 2] = value;
      maskData[baseIndex + 3] = 255; // アルファは常に不透明
    }
    
    return new ImageData(maskData, width, height);
  },
  
  /**
   * RGBを16進数カラーコードに変換
   * @param {Number} r - 赤成分（0-255）
   * @param {Number} g - 緑成分（0-255）
   * @param {Number} b - 青成分（0-255）
   * @returns {String} 16進数カラーコード
   * @private
   */
  _rgbToHex: function(r, g, b) {
    return '#' + [r, g, b]
      .map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      })
      .join('');
  },
  
  /**
   * 代替カラー処理：Base64画像埋め込み
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @param {Function} updateProgress - 進捗更新関数
   * @returns {Promise<String>} SVG文字列
   * @private
   */
  _createSimpleColorSVG: function(imageData, options, updateProgress) {
    return new Promise((resolve) => {
      try {
        // 簡易実装：カラー画像はbase64化してSVGに埋め込む
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
        
        updateProgress(60);
        
        // 画質を適切に設定して変換（メモリ使用量削減のため）
        const imageQuality = 0.8; // 画質設定（0.0〜1.0）
        const base64Image = canvas.toDataURL('image/png', imageQuality);
        
        updateProgress(90);
        
        // SVGの生成（適切にエスケープ）
        const svg = this._createSVGWithImage(imageData.width, imageData.height, base64Image);
        
        updateProgress(100);
        resolve(svg);
      } catch (error) {
        console.error('カラー変換エラー:', error);
        // エラーが発生した場合でも最低限のSVGを返す
        const svg = this._createEmptySVG(imageData.width, imageData.height);
        resolve(svg);
      }
    });
  },
  
  /**
   * Base64画像を含むSVGを生成する
   * @param {Number} width - 画像の幅
   * @param {Number} height - 画像の高さ
   * @param {String} base64Image - Base64エンコードされた画像データ
   * @returns {String} SVG文字列
   * @private
   */
  _createSVGWithImage: function(width, height, base64Image) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image width="${width}" height="${height}" href="${base64Image}"/>
</svg>`;
  },
  
  /**
   * 空のSVGを生成する（エラー時のフォールバック）
   * @param {Number} width - 画像の幅
   * @param {Number} height - 画像の高さ
   * @returns {String} SVG文字列
   * @private
   */
  _createEmptySVG: function(width, height) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#f0f0f0"/>
  <text x="${width/2}" y="${height/2}" font-family="sans-serif" font-size="24" text-anchor="middle">変換エラー</text>
</svg>`;
  },
  
  /**
   * 画像URLからSVGを生成する（ヘルパーメソッド）
   * @param {String} url - 画像URL
   * @param {Object} options - 変換オプション
   * @param {Function} progressCallback - 進捗コールバック関数
   * @returns {Promise<String>} SVG文字列を解決するPromise
   */
  imageURLToSVG: function(url, options = {}, progressCallback = null) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.imageToSVG(img, options, progressCallback)
          .then(svg => resolve(svg))
          .catch(err => reject(err));
      };
      
      img.onerror = () => {
        reject(new Error('画像の読み込みに失敗しました'));
      };
      
      img.src = url;
    });
  },
  
  /**
   * File/BlobオブジェクトからSVGを生成する（ヘルパーメソッド）
   * @param {File|Blob} file - ファイルまたはBlobオブジェクト
   * @param {Object} options - 変換オプション
   * @param {Function} progressCallback - 進捗コールバック関数
   * @returns {Promise<String>} SVG文字列を解決するPromise
   */
  fileToSVG: function(file, options = {}, progressCallback = null) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          const imageURL = event.target.result;
          
          // ファイルサイズが大きすぎる場合は警告
          if (imageURL.length > 10000000) { // 約10MB
            console.warn('画像ファイルが大きいです。処理に時間がかかる場合があります。');
          }
          
          this.imageURLToSVG(imageURL, options, progressCallback)
            .then(svg => resolve(svg))
            .catch(err => reject(err));
        };
        
        reader.onerror = () => {
          reject(new Error('ファイルの読み込みに失敗しました'));
        };
        
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('ファイル処理エラー:', error);
        reject(error);
      }
    });
  },
  
  /**
   * レイヤーの色を変更する
   * @param {String} svgString - SVG文字列
   * @param {String} layerId - 変更対象レイヤーのID
   * @param {String} newColor - 新しい色（16進数表記）
   * @returns {String} 更新されたSVG文字列
   */
  updateLayerColor: function(svgString, layerId, newColor) {
    try {
      // SVG文字列をDOMに変換
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      
      // レイヤーの検索
      const layerElement = svgDoc.getElementById(layerId);
      if (!layerElement) {
        throw new Error(`レイヤーID "${layerId}" が見つかりません`);
      }
      
      // レイヤーのdata-color属性を更新
      layerElement.setAttribute('data-color', newColor);
      
      // レイヤー内のパス要素を検索して色を更新
      const paths = layerElement.querySelectorAll('path');
      paths.forEach(path => {
        path.setAttribute('fill', newColor);
      });
      
      // 更新したSVGを文字列に戻す
      const serializer = new XMLSerializer();
      return serializer.serializeToString(svgDoc);
    } catch (error) {
      console.error('レイヤー色変更エラー:', error);
      return svgString; // エラー時は元のSVGを返す
    }
  },
  
  /**
   * レイヤーの可視性を変更する
   * @param {String} svgString - SVG文字列
   * @param {String} layerId - 変更対象レイヤーのID
   * @param {Boolean} visible - 可視状態
   * @returns {String} 更新されたSVG文字列
   */
  setLayerVisibility: function(svgString, layerId, visible) {
    try {
      // SVG文字列をDOMに変換
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      
      // レイヤーの検索
      const layerElement = svgDoc.getElementById(layerId);
      if (!layerElement) {
        throw new Error(`レイヤーID "${layerId}" が見つかりません`);
      }
      
      // 可視性を設定
      if (visible) {
        layerElement.removeAttribute('display');
        layerElement.setAttribute('data-visible', 'true');
      } else {
        layerElement.setAttribute('display', 'none');
        layerElement.setAttribute('data-visible', 'false');
      }
      
      // 更新したSVGを文字列に戻す
      const serializer = new XMLSerializer();
      return serializer.serializeToString(svgDoc);
    } catch (error) {
      console.error('レイヤー可視性変更エラー:', error);
      return svgString; // エラー時は元のSVGを返す
    }
  },
  
  /**
   * SVGからレイヤー情報を抽出する
   * @param {String} svgString - SVG文字列
   * @returns {Array<Object>} レイヤー情報の配列
   */
  extractLayers: function(svgString) {
    try {
      // SVG文字列をDOMに変換
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
      
      // レイヤー要素（g要素）を検索
      const layerElements = svgDoc.querySelectorAll('g[data-editable="true"]');
      
      // レイヤー情報を抽出
      const layers = Array.from(layerElements).map((layer, index) => {
        return {
          id: layer.id || `layer_${index}`,
          name: layer.getAttribute('data-name') || `レイヤー${index + 1}`,
          color: layer.getAttribute('data-color') || '#000000',
          visible: layer.getAttribute('display') !== 'none',
          index: index
        };
      });
      
      return layers;
    } catch (error) {
      console.error('レイヤー抽出エラー:', error);
      return []; // エラー時は空配列を返す
    }
  }
};

// ブラウザ環境ではWindowオブジェクトに追加
if (typeof window !== 'undefined') {
  window.ImageTracer = ImageTracer;
}

// Node.js環境ではエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ImageTracer;
} 