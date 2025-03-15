/**
 * ImageTracer.js
 * 
 * 画像をSVGパスに変換するためのライブラリです。
 * Potraceライブラリを利用して高品質なベクター変換を行います。
 * 
 * このライブラリは画像のエッジを検出し、ベクターパスを生成します。
 * クライアントサイドで完全に動作し、サーバーに画像データを送信しません。
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
        outputFormat: 'svg' // 'svg' または 'path'（パスデータのみ）
      };
      
      const opts = { ...defaultOptions, ...options };
      
      // 進捗コールバックがなければ空の関数を設定
      const updateProgress = progressCallback || (() => {});
      
      try {
        // 初期進捗の通知
        updateProgress(5);
        
        // Canvasの作成と画像の描画
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = imageObj.width * opts.scale;
        canvas.height = imageObj.height * opts.scale;
        
        ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);
        
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
        
        // Potraceインスタンスの作成
        const potrace = window.Potrace ? window.Potrace.Potrace.getInstance() : null;
        
        if (!potrace) {
          throw new Error('Potraceライブラリが見つかりません');
        }
        
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
        reject(error);
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
        
        // Base64形式の画像データを取得
        const base64Image = canvas.toDataURL('image/png');
        
        // SVGの生成
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageData.width}" height="${imageData.height}" viewBox="0 0 ${imageData.width} ${imageData.height}">
          <image width="${imageData.width}" height="${imageData.height}" href="${base64Image}"/>
        </svg>`;
        
        updateProgress(100);
        resolve(svg);
      } catch (error) {
        reject(error);
      }
    });
  },
  
  /**
   * 画像URLからSVGを生成する（ヘルパーメソッド）
   * @param {String} url - 画像URL
   * @param {Object} options - 変換オプション
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
   * @returns {Promise<String>} SVG文字列を解決するPromise
   */
  fileToSVG: function(file, options = {}, progressCallback = null) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        this.imageURLToSVG(event.target.result, options, progressCallback)
          .then(svg => resolve(svg))
          .catch(err => reject(err));
      };
      
      reader.onerror = () => {
        reject(new Error('ファイルの読み込みに失敗しました'));
      };
      
      reader.readAsDataURL(file);
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