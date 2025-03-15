/**
 * imagetracer-utils.js
 * 
 * ImageTracerのユーティリティ機能を提供します。
 * ファイル処理、ヘルパー関数、データ変換などを含みます。
 * 
 * @version 3.5.0
 * @module ImageTracerUtils
 */

/**
 * ImageTracerUtilsモジュール
 * ユーティリティ関数とヘルパー機能を提供します。
 */
(function() {
  'use strict';
  
  // モジュールが既に定義されていれば使用する
  window.ImageTracerUtils = window.ImageTracerUtils || {};
  
  /**
   * ファイルから画像要素を作成します
   * @param {File} file - 画像ファイル
   * @returns {Promise<HTMLImageElement>} 画像要素
   */
  window.ImageTracerUtils.createImageFromFile = function(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('無効なファイル形式です。画像ファイルを選択してください。'));
        return;
      }
      
      // 画像形式をログ出力（デバッグ用）
      console.log('画像形式:', file.type);
      
      const img = new Image();
      let objectURL = null;
      
      // CORS設定を追加
      img.crossOrigin = 'anonymous';
      
      img.onload = function() {
        // 読み込み成功時にはBlobURLをメモリから解放
        if (objectURL) {
          setTimeout(() => {
            URL.revokeObjectURL(objectURL);
          }, 100);
        }
        resolve(img);
      };
      
      img.onerror = function(error) {
        // 読み込み失敗時にはエラーログ出力
        console.error('画像読み込みエラー:', error);
        
        // BlobURLをメモリから解放
        if (objectURL) {
          URL.revokeObjectURL(objectURL);
        }
        
        // FileReaderを使った代替読み込み方法を試行
        const reader = new FileReader();
        
        reader.onload = function(event) {
          img.onload = function() {
            resolve(img);
          };
          
          img.onerror = function() {
            reject(new Error('画像の読み込みに失敗しました。サポートされていない形式かファイルが破損している可能性があります。'));
          };
          
          img.src = event.target.result;
        };
        
        reader.onerror = function() {
          reject(new Error('ファイルの読み込みに失敗しました。'));
        };
        
        reader.readAsDataURL(file);
      };
      
      // BlobURLを作成して画像を読み込む
      objectURL = URL.createObjectURL(file);
      img.src = objectURL;
    });
  };
  
  /**
   * データURLをBlobに変換します
   * @param {string} dataURL - データURL
   * @returns {Blob} Blobオブジェクト
   */
  window.ImageTracerUtils.dataURLtoBlob = function(dataURL) {
    // データURLをバイナリに変換
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    
    // バイナリをArrayBufferに変換
    const uInt8Array = new Uint8Array(rawLength);
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    
    // ArrayBufferからBlobを作成
    return new Blob([uInt8Array], { type: contentType });
  };
  
  /**
   * 色の明るさを計算します
   * @param {number} r - 赤 (0-255)
   * @param {number} g - 緑 (0-255)
   * @param {number} b - 青 (0-255)
   * @returns {number} 明るさ (0-255)
   */
  window.ImageTracerUtils.calculateBrightness = function(r, g, b) {
    // 人間の目の感度に基づいた明るさの計算
    // 緑が最も感度が高く、青が最も感度が低い
    return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  };
  
  /**
   * RGB色をHSLに変換します
   * @param {number} r - 赤 (0-255)
   * @param {number} g - 緑 (0-255)
   * @param {number} b - 青 (0-255)
   * @returns {Object} HSL値 {h: 0-360, s: 0-100, l: 0-100}
   */
  window.ImageTracerUtils.rgbToHsl = function(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      // 無彩色の場合
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      
      h /= 6;
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  };
  
  /**
   * HSL色をRGBに変換します
   * @param {number} h - 色相 (0-360)
   * @param {number} s - 彩度 (0-100)
   * @param {number} l - 明度 (0-100)
   * @returns {Object} RGB値 {r: 0-255, g: 0-255, b: 0-255}
   */
  window.ImageTracerUtils.hslToRgb = function(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    let r, g, b;
    
    if (s === 0) {
      // 無彩色の場合
      r = g = b = l;
    } else {
      const hue2rgb = function(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  };
  
  /**
   * RGB値を16進数カラーコードに変換します
   * @param {number} r - 赤 (0-255)
   * @param {number} g - 緑 (0-255)
   * @param {number} b - 青 (0-255)
   * @returns {string} 16進数カラーコード（先頭に#付き）
   */
  window.ImageTracerUtils.rgbToHex = function(r, g, b) {
    const toHex = function(c) {
      const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return '#' + toHex(r) + toHex(g) + toHex(b);
  };
  
  /**
   * 16進数カラーコードをRGBに変換します
   * @param {string} hex - 16進数カラーコード
   * @returns {Object} RGB値 {r: 0-255, g: 0-255, b: 0-255}
   */
  window.ImageTracerUtils.hexToRgb = function(hex) {
    // #を削除し、3桁の場合は6桁に拡張
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    
    return { r, g, b };
  };
  
  /**
   * ファイル名から拡張子を取得します
   * @param {string} filename - ファイル名
   * @returns {string} 拡張子（ドットなし、小文字）
   */
  window.ImageTracerUtils.getFileExtension = function(filename) {
    if (!filename) return '';
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2).toLowerCase();
  };
  
  /**
   * ファイル名から拡張子を除いた部分を取得します
   * @param {string} filename - ファイル名
   * @returns {string} 拡張子を除いたファイル名
   */
  window.ImageTracerUtils.getFileNameWithoutExtension = function(filename) {
    if (!filename) return '';
    const lastDotPosition = filename.lastIndexOf('.');
    if (lastDotPosition === -1) return filename;
    return filename.substr(0, lastDotPosition);
  };
  
  /**
   * MIMEタイプから対応するファイル拡張子を取得します
   * @param {string} mimeType - MIMEタイプ
   * @returns {string} ファイル拡張子（ドットなし）
   */
  window.ImageTracerUtils.getMimeTypeExtension = function(mimeType) {
    const mimeTypes = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/tiff': 'tiff'
    };
    
    return mimeTypes[mimeType] || '';
  };
  
  /**
   * 一時的なキャンバスを作成します
   * @param {number} width - 幅
   * @param {number} height - 高さ
   * @returns {Object} キャンバスと2Dコンテキスト {canvas, ctx}
   */
  window.ImageTracerUtils.createTempCanvas = function(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  };
  
  /**
   * パフォーマンス測定のためのシンプルなタイマーを作成します
   * @returns {Object} タイマーオブジェクト
   */
  window.ImageTracerUtils.createTimer = function() {
    const timer = {
      startTime: null,
      laps: [],
      
      start: function() {
        this.startTime = performance.now();
        this.laps = [];
        return this;
      },
      
      lap: function(label) {
        if (!this.startTime) this.start();
        const lapTime = performance.now();
        const lapDuration = lapTime - (this.laps.length ? this.laps[this.laps.length - 1].time : this.startTime);
        this.laps.push({
          label: label || `ラップ ${this.laps.length + 1}`,
          time: lapTime,
          duration: lapDuration,
          totalDuration: lapTime - this.startTime
        });
        return lapDuration;
      },
      
      stop: function() {
        const stopTime = performance.now();
        const totalDuration = stopTime - this.startTime;
        return {
          laps: this.laps,
          totalDuration: totalDuration
        };
      },
      
      getReport: function() {
        const result = this.stop();
        let report = `合計処理時間: ${result.totalDuration.toFixed(2)}ms\n`;
        result.laps.forEach(lap => {
          report += `- ${lap.label}: ${lap.duration.toFixed(2)}ms (${(lap.duration / result.totalDuration * 100).toFixed(1)}%)\n`;
        });
        return report;
      }
    };
    
    return timer;
  };
})(); 