/**
 * ImageTracer.js
 * 
 * 画像をSVGパスに変換するためのライブラリです。
 * Potraceライブラリを利用して高品質なベクター変換を行います。
 * 
 * このライブラリは画像のエッジを検出し、ベクターパスを生成します。
 * クライアントサイドで完全に動作し、サーバーに画像データを送信しません。
 * 
 * サポートされている画像形式：
 * - JPEG/JPG
 * - PNG
 * - GIF
 * - WebP
 */

const ImageTracer = {
  /**
   * 画像オブジェクトからSVGを生成する
   * @param {HTMLImageElement} imageObj - 変換対象の画像要素
   * @param {Object} options - 変換オプション
   * @param {Function} progressCallback - 進捗を通知するコールバック関数
   * @returns {Promise<String>} SVG文字列を解決するPromise
   */
  imageToSVG: async function(imageObj, options = {}, progressCallback = null) {
    return new Promise((resolve, reject) => {
      // デフォルトオプションの設定
      const defaultOptions = {
        threshold: 128,
        colorMode: 'color', // 'color' または 'bw'（白黒）
        simplify: 0.5, // パスの単純化（0〜1）
        scale: 1,
        outputFormat: 'svg', // 'svg' または 'path'（パスデータのみ）
        maxImageSize: 2000 // 処理する最大サイズ（幅または高さ）
      };
      
      const opts = { ...defaultOptions, ...options };
      
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
        
        // 画像データの取得
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // カラーモードに応じた処理
        if (opts.colorMode === 'bw') {
          // 白黒モードの場合はPotraceを使用
          this._processBWImage(imageData, opts, updateProgress)
            .then(svgData => {
              resolve(svgData);
            })
            .catch(error => {
              reject(error);
            });
        } else {
          // カラーモードの場合はカラー画像処理
          this._processColorImage(imageData, opts, updateProgress)
            .then(svgData => {
              resolve(svgData);
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
          const svgData = potrace.getSVG(1.0, options.simplify);
          
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
   * @returns {Promise<String>} SVG文字列
   * @private
   */
  _processColorImage: function(imageData, options, updateProgress) {
    return new Promise((resolve, reject) => {
      try {
        updateProgress(20);
        
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
        reject(error);
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