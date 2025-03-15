/**
 * @module ImageTracerCore
 * @description 画像をSVGに変換するためのコア画像処理機能
 * @version 3.5.1
 * @license MIT
 * 
 * このモジュールは、画像データの処理とSVGパス生成のためのコア機能を提供します。
 * 画像データの取得、ブラー効果の適用、リサイズ、色抽出、量子化などの機能を含みます。
 */

// グローバル名前空間にImageTracerCoreを定義
window.ImageTracerCore = (function() {
  'use strict';
  
  /**
   * 画像データを取得します
   * @param {HTMLImageElement|HTMLCanvasElement} imageOrCanvas - 画像またはキャンバス要素
   * @returns {ImageData} 画像データ
   */
  function getImageData(imageOrCanvas) {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // 画像かキャンバスかによって処理を分ける
      if (imageOrCanvas instanceof HTMLImageElement) {
        canvas.width = imageOrCanvas.naturalWidth;
        canvas.height = imageOrCanvas.naturalHeight;
        ctx.drawImage(imageOrCanvas, 0, 0);
      } else if (imageOrCanvas instanceof HTMLCanvasElement) {
        canvas.width = imageOrCanvas.width;
        canvas.height = imageOrCanvas.height;
        ctx.drawImage(imageOrCanvas, 0, 0);
      } else {
        throw new Error('無効な入力: HTMLImageElementまたはHTMLCanvasElementが必要です');
      }
      
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('画像データの取得に失敗しました:', error);
      throw new Error('画像データの取得に失敗しました: ' + error.message);
    }
  }
  
  /**
   * Canvas要素から画像データを取得します
   * @param {HTMLCanvasElement} canvas - キャンバス要素
   * @returns {ImageData} 画像データ
   */
  function getImageDataFromCanvas(canvas) {
    try {
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('無効な入力: HTMLCanvasElementが必要です');
      }
      
      const ctx = canvas.getContext('2d');
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('キャンバスからの画像データ取得に失敗しました:', error);
      throw new Error('キャンバスからの画像データ取得に失敗しました: ' + error.message);
    }
  }
  
  /**
   * 画像をリサイズします
   * @param {HTMLImageElement} image - リサイズする画像
   * @param {number} maxSize - 最大サイズ（幅または高さ）
   * @returns {HTMLCanvasElement} リサイズされた画像を含むキャンバス
   */
  function resizeImage(image, maxSize) {
    try {
      if (!maxSize) maxSize = 2000; // デフォルト最大サイズ
      
      if (!image || !(image instanceof HTMLImageElement)) {
        throw new Error('無効な画像要素が指定されました');
      }
      
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        throw new Error('画像のサイズが無効です');
      }
      
      if (image.naturalWidth <= maxSize && image.naturalHeight <= maxSize) {
        // リサイズ不要な場合はそのままキャンバスに描画して返す
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return canvas;
      }
      
      // リサイズが必要な場合、アスペクト比を維持しながらリサイズ
      const canvas = document.createElement('canvas');
      let newWidth, newHeight;
      
      if (image.naturalWidth > image.naturalHeight) {
        // 横長の画像
        newWidth = maxSize;
        newHeight = Math.floor(image.naturalHeight * (maxSize / image.naturalWidth));
      } else {
        // 縦長または正方形の画像
        newHeight = maxSize;
        newWidth = Math.floor(image.naturalWidth * (maxSize / image.naturalHeight));
      }
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      
      // 高品質リサイズのための設定
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(image, 0, 0, newWidth, newHeight);
      
      console.log(`画像をリサイズしました: ${image.naturalWidth}x${image.naturalHeight} -> ${newWidth}x${newHeight}`);
      
      return canvas;
    } catch (error) {
      console.error('画像のリサイズに失敗しました:', error);
      throw new Error('画像のリサイズに失敗しました: ' + error.message);
    }
  }
  
  /**
   * 画像にブラー効果を適用します
   * @param {ImageData} imageData - 画像データ
   * @param {number} radius - ブラー半径
   * @returns {ImageData} ブラー効果が適用された画像データ
   */
  function applyBlur(imageData, radius) {
    try {
      if (!radius || radius <= 0) return imageData;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      
      // 元の画像データをキャンバスに描画
      ctx.putImageData(imageData, 0, 0);
      
      // フィルターでぼかし効果を適用
      ctx.filter = `blur(${radius}px)`;
      ctx.drawImage(canvas, 0, 0);
      
      // ぼかし効果を適用した結果を取得
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('ブラー効果の適用に失敗しました:', error);
      // エラーが発生した場合は元の画像データを返す
      return imageData;
    }
  }
  
  /**
   * Base64エンコードされた画像データを生成します
   * @param {HTMLCanvasElement} canvas - キャンバス要素
   * @param {string} format - 画像フォーマット（'image/png', 'image/jpeg'など）
   * @param {number} quality - 画像品質（0.0～1.0、JPEG/WebP形式で使用）
   * @returns {string} Base64エンコードされた画像データ
   */
  function canvasToBase64(canvas, format = 'image/png', quality = 0.8) {
    try {
      return canvas.toDataURL(format, quality);
    } catch (error) {
      console.error('Base64エンコードに失敗しました:', error);
      throw new Error('Base64エンコードに失敗しました: ' + error.message);
    }
  }
  
  /**
   * 画像データから指定された色だけを抽出したマスクを作成します
   * @param {ImageData} imageData - 画像データ
   * @param {Array} targetColor - 抽出する色 [R, G, B]
   * @param {number} tolerance - 色の許容誤差（0～255）
   * @returns {ImageData} 指定色のみを含むマスク画像データ
   */
  function createColorMask(imageData, targetColor, tolerance = 30) {
    try {
      const { width, height, data } = imageData;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = width;
      maskCanvas.height = height;
      const maskCtx = maskCanvas.getContext('2d');
      const maskData = maskCtx.createImageData(width, height);
      
      // ターゲット色のRGB値
      const targetR = targetColor[0];
      const targetG = targetColor[1];
      const targetB = targetColor[2];
      
      // 各ピクセルを処理
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        
        // 完全に透明なピクセルはスキップ
        if (a < 10) {
          maskData.data[i] = 0;
          maskData.data[i + 1] = 0;
          maskData.data[i + 2] = 0;
          maskData.data[i + 3] = 0;
          continue;
        }
        
        // 色の距離を計算
        const distance = Math.sqrt(
          Math.pow(r - targetR, 2) +
          Math.pow(g - targetG, 2) +
          Math.pow(b - targetB, 2)
        );
        
        if (distance <= tolerance) {
          // 指定色と一致: 黒（トレース対象）
          maskData.data[i] = 0;
          maskData.data[i + 1] = 0;
          maskData.data[i + 2] = 0;
          maskData.data[i + 3] = 255;
        } else {
          // 一致しない: 白（背景）
          maskData.data[i] = 255;
          maskData.data[i + 1] = 255;
          maskData.data[i + 2] = 255;
          maskData.data[i + 3] = 255;
        }
      }
      
      return maskData;
    } catch (error) {
      console.error('カラーマスクの作成に失敗しました:', error);
      throw new Error('カラーマスクの作成に失敗しました: ' + error.message);
    }
  }
  
  /**
   * 色空間を分割して量子化します（メディアンカット法）
   * @param {Array} pixels - ピクセルデータ配列
   * @param {number} depth - 現在の再帰の深さ
   * @param {number} maxDepth - 最大再帰の深さ（色の数 = 2^maxDepth）
   * @returns {Array} 量子化された色の配列
   */
  function splitColorSpace(pixels, depth, maxDepth) {
    try {
      if (depth === maxDepth || pixels.length === 0) {
        // 最大深さに達したか、ピクセルがない場合は代表色を返す
        const avgColor = [0, 0, 0, 0];
        
        if (pixels.length) {
          // 平均色を計算
          pixels.forEach(pixel => {
            avgColor[0] += pixel[0];
            avgColor[1] += pixel[1];
            avgColor[2] += pixel[2];
            avgColor[3] += pixel[3];
          });
          
          avgColor[0] = Math.round(avgColor[0] / pixels.length);
          avgColor[1] = Math.round(avgColor[1] / pixels.length);
          avgColor[2] = Math.round(avgColor[2] / pixels.length);
          avgColor[3] = Math.round(avgColor[3] / pixels.length);
        }
        
        return [avgColor];
      }
      
      // 色の範囲を計算（R, G, B）
      const min = [255, 255, 255];
      const max = [0, 0, 0];
      
      pixels.forEach(pixel => {
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], pixel[i]);
          max[i] = Math.max(max[i], pixel[i]);
        }
      });
      
      // 最大の範囲を持つチャンネルを見つける
      let maxRange = 0;
      let maxRangeIndex = 0;
      
      for (let i = 0; i < 3; i++) {
        const range = max[i] - min[i];
        if (range > maxRange) {
          maxRange = range;
          maxRangeIndex = i;
        }
      }
      
      // 範囲が0の場合（すべてのピクセルが同じ色）
      if (maxRange === 0) {
        return [pixels[0]];
      }
      
      // 色空間を分割するための中央値を見つける
      pixels.sort((a, b) => a[maxRangeIndex] - b[maxRangeIndex]);
      const medianIndex = Math.floor(pixels.length / 2);
      
      // 色空間を分割して再帰的に処理
      const set1 = pixels.slice(0, medianIndex);
      const set2 = pixels.slice(medianIndex);
      
      return [
        ...splitColorSpace(set1, depth + 1, maxDepth),
        ...splitColorSpace(set2, depth + 1, maxDepth)
      ];
    } catch (error) {
      console.error('色空間の分割に失敗しました:', error);
      // エラーが発生した場合、基本的な色セットを返す
      return [[0, 0, 0, 255], [255, 255, 255, 255]];
    }
  }
  
  /**
   * 画像の色を量子化します
   * @param {ImageData} imageData - 画像データ
   * @param {number} colorCount - 量子化する色の数
   * @returns {Array} 量子化された色の配列 [[R, G, B], ...]
   */
  function quantizeColors(imageData, colorCount) {
    try {
      // 色の数が2未満の場合は修正
      colorCount = Math.max(2, Math.min(64, colorCount));
      
      // 処理するピクセル数が多すぎる場合は警告
      const totalPixels = imageData.width * imageData.height;
      if (totalPixels > 1000000) {
        console.warn(`大きな画像（${imageData.width}x${imageData.height}）の色量子化を行います。処理に時間がかかる場合があります。`);
      }
      
      // 色の数をビット深度に変換（2^n = colorCount）
      const maxDepth = Math.ceil(Math.log2(colorCount));
      
      // ピクセルデータを配列に変換
      const { data, width, height } = imageData;
      const pixels = [];
      
      // 有効なピクセルを抽出（透明ピクセルは除外）
      for (let i = 0; i < data.length; i += 4) {
        // 透明度が低いピクセルは無視
        if (data[i + 3] < 10) continue;
        
        pixels.push([
          data[i],     // R
          data[i + 1], // G
          data[i + 2], // B
          data[i + 3]  // A
        ]);
      }
      
      // サンプリング（ピクセル数が多すぎる場合）
      const maxSamples = 10000;
      let sampledPixels = pixels;
      
      if (pixels.length > maxSamples) {
        sampledPixels = [];
        const sampleInterval = Math.floor(pixels.length / maxSamples);
        
        for (let i = 0; i < pixels.length; i += sampleInterval) {
          sampledPixels.push(pixels[i]);
        }
        
        console.log(`量子化のためのピクセルサンプリング: ${pixels.length} → ${sampledPixels.length}ピクセル`);
      }
      
      // 色空間を分割して量子化
      const quantizedColors = splitColorSpace(sampledPixels, 0, maxDepth);
      
      // 量子化された色の配列を返す
      return quantizedColors;
    } catch (error) {
      console.error('色の量子化に失敗しました:', error);
      // エラー発生時は基本色セットを返す
      return [
        [0, 0, 0, 255],       // 黒
        [255, 255, 255, 255], // 白
        [255, 0, 0, 255],     // 赤
        [0, 255, 0, 255],     // 緑
        [0, 0, 255, 255],     // 青
        [255, 255, 0, 255],   // 黄
        [255, 0, 255, 255],   // マゼンタ
        [0, 255, 255, 255]    // シアン
      ];
    }
  }
  
  /**
   * フォールバック用の基本SVGを生成します
   * @param {number} width - 画像の幅
   * @param {number} height - 画像の高さ
   * @param {string} message - エラーメッセージまたは説明
   * @returns {string} SVGデータ
   */
  function createFallbackSVG(width, height, message) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f8f9fa" />
      <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="#666">${message || 'SVG生成に失敗しました'}</text>
    </svg>`;
  }
  
  // 公開API
  return {
    getImageData: getImageData,
    getImageDataFromCanvas: getImageDataFromCanvas,
    resizeImage: resizeImage,
    applyBlur: applyBlur,
    canvasToBase64: canvasToBase64,
    createColorMask: createColorMask,
    splitColorSpace: splitColorSpace,
    quantizeColors: quantizeColors,
    createFallbackSVG: createFallbackSVG
  };
})(); 