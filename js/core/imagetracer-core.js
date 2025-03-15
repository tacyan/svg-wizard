/**
 * @module ImageTracerCore
 * @description 画像をSVGに変換するためのコア画像処理機能
 * @version 4.0.0
 * @license MIT
 * 
 * このモジュールは、画像データの処理とSVGパス生成のためのコア機能を提供します。
 * 画像データの取得、ブラー効果の適用、リサイズ、色抽出、量子化などの機能を含みます。
 * 高度な物体認識とセグメンテーションによる効果的なレイヤー分離を実現します。
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
  
  /**
   * 高度な物体認識のためのエッジ検出を行います
   * @param {ImageData} imageData - 画像データ
   * @param {number} threshold - エッジ検出の閾値（0-255）
   * @returns {Uint8Array} エッジデータ
   */
  function detectEdges(imageData, threshold = 30) {
    const { width, height, data } = imageData;
    const edgeData = new Uint8Array(width * height);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    // グレースケールに変換
    const gray = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        // 輝度変換（人間の視覚に合わせた重み付け）
        gray[y * width + x] = Math.round(
          data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114
        );
      }
    }
    
    // Sobelフィルタでエッジ検出
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        let idx = 0;
        
        // 3x3カーネルの適用
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = gray[(y + ky) * width + (x + kx)];
            gx += pixel * sobelX[idx];
            gy += pixel * sobelY[idx];
            idx++;
          }
        }
        
        // エッジの強度を計算
        const g = Math.sqrt(gx * gx + gy * gy);
        
        // 閾値との比較
        edgeData[y * width + x] = g > threshold ? 255 : 0;
      }
    }
    
    return edgeData;
  }
  
  /**
   * 物体のセグメンテーションを行います（Watershed法）
   * @param {ImageData} imageData - 画像データ
   * @param {Uint8Array} edgeData - エッジデータ
   * @param {number} minSize - 最小セグメントサイズ
   * @returns {Int32Array} セグメント番号の配列
   */
  function segmentImage(imageData, edgeData, minSize = 100) {
    const { width, height } = imageData;
    const segments = new Int32Array(width * height).fill(-1);
    let nextLabel = 0;
    
    // フラッドフィル用のキュー
    const queue = [];
    
    // 画像全体をスキャン
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        // 未処理かつエッジでない場所を検索
        if (segments[idx] === -1 && edgeData[idx] === 0) {
          // 新しいセグメントを開始
          const label = nextLabel++;
          queue.push([x, y]);
          segments[idx] = label;
          
          // セグメントサイズを記録
          let size = 1;
          
          // フラッドフィル
          while (queue.length > 0) {
            const [cx, cy] = queue.shift();
            
            // 近傍8ピクセルをチェック
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = cx + dx;
                const ny = cy + dy;
                
                // 画像の範囲内かチェック
                if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                  const nidx = ny * width + nx;
                  
                  // 未処理かつエッジでない場所を同じセグメントに追加
                  if (segments[nidx] === -1 && edgeData[nidx] === 0) {
                    segments[nidx] = label;
                    queue.push([nx, ny]);
                    size++;
                  }
                }
              }
            }
          }
          
          // 小さすぎるセグメントを削除（ノイズ除去）
          if (size < minSize) {
            for (let i = 0; i < segments.length; i++) {
              if (segments[i] === label) {
                segments[i] = -1;
              }
            }
            nextLabel--; // ラベルを再利用
          }
        }
      }
    }
    
    // 未処理の部分（エッジ）に最も近いセグメントを割り当て
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (segments[idx] === -1) {
          let bestLabel = -1;
          let minDist = Infinity;
          
          // 近接セグメントを検索（単純な実装）
          for (let r = 1; r < 5 && bestLabel === -1; r++) {
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (Math.abs(dx) + Math.abs(dy) > r) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                  const nidx = ny * width + nx;
                  if (segments[nidx] >= 0) {
                    const dist = dx * dx + dy * dy;
                    if (dist < minDist) {
                      minDist = dist;
                      bestLabel = segments[nidx];
                    }
                  }
                }
              }
            }
          }
          
          if (bestLabel >= 0) {
            segments[idx] = bestLabel;
          } else {
            // 見つからない場合は新しいセグメントを作成
            segments[idx] = nextLabel++;
          }
        }
      }
    }
    
    return { segments, count: nextLabel };
  }
  
  /**
   * セグメントの色を計算します
   * @param {ImageData} imageData - 画像データ
   * @param {Int32Array} segments - セグメント番号の配列
   * @param {number} segmentCount - セグメント数
   * @returns {Array} セグメントごとの色情報の配列
   */
  function calculateSegmentColors(imageData, segments, segmentCount) {
    const { width, height, data } = imageData;
    const colors = new Array(segmentCount).fill(0).map(() => ({ r: 0, g: 0, b: 0, a: 0, count: 0 }));
    
    // 各セグメントの平均色を計算
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const dataIdx = idx * 4;
        const segmentId = segments[idx];
        
        if (segmentId >= 0 && segmentId < segmentCount) {
          colors[segmentId].r += data[dataIdx];
          colors[segmentId].g += data[dataIdx + 1];
          colors[segmentId].b += data[dataIdx + 2];
          colors[segmentId].a += data[dataIdx + 3];
          colors[segmentId].count++;
        }
      }
    }
    
    // 平均値の計算
    for (let i = 0; i < segmentCount; i++) {
      if (colors[i].count > 0) {
        colors[i].r = Math.round(colors[i].r / colors[i].count);
        colors[i].g = Math.round(colors[i].g / colors[i].count);
        colors[i].b = Math.round(colors[i].b / colors[i].count);
        colors[i].a = Math.round(colors[i].a / colors[i].count);
      }
    }
    
    return colors;
  }
  
  /**
   * セグメントごとにマスク画像を生成します
   * @param {Int32Array} segments - セグメント番号の配列
   * @param {number} width - 画像の幅
   * @param {number} height - 画像の高さ
   * @param {number} segmentId - セグメントID
   * @returns {ImageData} マスク画像データ
   */
  function createSegmentMask(segments, width, height, segmentId) {
    const maskData = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const dataIdx = idx * 4;
        
        if (segments[idx] === segmentId) {
          // セグメントに含まれる場合は黒（トレース対象）
          maskData[dataIdx] = 0;
          maskData[dataIdx + 1] = 0;
          maskData[dataIdx + 2] = 0;
          maskData[dataIdx + 3] = 255;
        } else {
          // セグメントに含まれない場合は白（背景）
          maskData[dataIdx] = 255;
          maskData[dataIdx + 1] = 255;
          maskData[dataIdx + 2] = 255;
          maskData[dataIdx + 3] = 255;
        }
      }
    }
    
    const maskImageData = new ImageData(maskData, width, height);
    return maskImageData;
  }
  
  /**
   * 物体認識ベースの高度な色抽出を行います
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 処理オプション
   * @returns {Object} セグメント情報と色情報
   */
  function extractObjectsWithColors(imageData, options = {}) {
    const { width, height } = imageData;
    
    // オプションの初期化
    const edgeThreshold = options.edgeThreshold || 30;
    const minSegmentSize = options.minSegmentSize || 100;
    const maxSegments = options.maxSegments || 32;
    
    // エッジ検出
    const edgeData = detectEdges(imageData, edgeThreshold);
    
    // セグメンテーション
    const { segments, count } = segmentImage(imageData, edgeData, minSegmentSize);
    
    // セグメントの色を計算
    let colors = calculateSegmentColors(imageData, segments, count);
    
    // セグメント情報を保持
    const segmentInfo = [];
    
    for (let i = 0; i < count; i++) {
      if (colors[i].count > 0) {
        segmentInfo.push({
          id: i,
          color: {
            r: colors[i].r,
            g: colors[i].g,
            b: colors[i].b,
            a: colors[i].a
          },
          size: colors[i].count,
          hex: rgbToHex(colors[i].r, colors[i].g, colors[i].b)
        });
      }
    }
    
    // サイズ順にソート（大きいものを優先）
    segmentInfo.sort((a, b) => b.size - a.size);
    
    // 最大数に制限
    if (segmentInfo.length > maxSegments) {
      segmentInfo.length = maxSegments;
    }
    
    return {
      width,
      height,
      segments,
      segmentInfo
    };
  }
  
  /**
   * RGB値を16進数表記に変換します
   * @param {number} r - 赤成分（0-255）
   * @param {number} g - 緑成分（0-255）
   * @param {number} b - 青成分（0-255）
   * @returns {string} 16進数表記
   */
  function rgbToHex(r, g, b) {
    const toHex = (c) => {
      const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  /**
   * セグメントごとに物体名をインテリジェントに推測します
   * @param {Object} segmentInfo - セグメント情報
   * @param {number} width - 画像の幅
   * @param {number} height - 画像の高さ
   * @returns {Array} 名前が付与されたセグメント情報
   */
  function inferObjectNames(segmentInfo, width, height) {
    // 位置に基づく命名（上部、中央、下部など）
    for (let i = 0; i < segmentInfo.length; i++) {
      const segment = segmentInfo[i];
      const relativeSize = segment.size / (width * height);
      
      // 色の名前を取得
      let colorName = getColorName(segment.color);
      
      // 大きさに基づく分類
      let sizeName = '';
      if (relativeSize > 0.5) {
        sizeName = '背景';
      } else if (relativeSize > 0.2) {
        sizeName = '大きい物体';
      } else if (relativeSize > 0.05) {
        sizeName = '中程度の物体';
      } else {
        sizeName = '小さい物体';
      }
      
      // 最終的な名前を設定
      segment.name = `${colorName}${sizeName}`;
      
      // Photopea用の追加属性
      segment.photopeaAttributes = {
        'data-name': segment.name,
        'data-layer-type': 'shape',
        'data-blending-mode': 'normal',
        'data-opacity': '1',
        'data-color': segment.hex,
        'data-smart-object': 'false',
        'data-vector-mask': 'true'
      };
    }
    
    return segmentInfo;
  }
  
  /**
   * 色からおおよその色名を取得します
   * @param {Object} color - 色情報（r, g, b）
   * @returns {string} 色名
   */
  function getColorName(color) {
    const { r, g, b } = color;
    
    // グレースケール判定
    const isGray = Math.abs(r - g) < 20 && Math.abs(r - b) < 20 && Math.abs(g - b) < 20;
    if (isGray) {
      const brightness = Math.round((r + g + b) / 3);
      if (brightness < 30) return '黒色';
      if (brightness < 80) return '暗灰色';
      if (brightness < 160) return '灰色';
      if (brightness < 220) return '明灰色';
      return '白色';
    }
    
    // 主要色の判定
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    if (max === r && (r - g) > 50 && (r - b) > 50) return '赤色';
    if (max === g && (g - r) > 30 && (g - b) > 30) return '緑色';
    if (max === b && (b - r) > 30 && (b - g) > 30) return '青色';
    
    if (r > 180 && g > 180 && b < 100) return '黄色';
    if (r > 180 && b > 150 && g < 100) return '紫色';
    if (g > 150 && b > 180 && r < 100) return '青緑色';
    if (r > 180 && g > 100 && b < 100) return 'オレンジ色';
    
    return '色';
  }
  
  /**
   * Photopea互換のレイヤー属性を作成します
   * @param {string} layerId - レイヤーID
   * @param {string} layerName - レイヤー名
   * @param {Object} color - 色情報 {r, g, b}
   * @param {Object} options - 追加オプション
   * @returns {Object} Photopea互換の属性オブジェクト
   */
  function createPhotopeaLayerAttributes(layerId, layerName, color, options = {}) {
    // 基本属性
    const attributes = {
      'data-photopea-layer': 'true',
      'data-name': layerName,
      'data-id': layerId,
      'data-color': `rgb(${color.r},${color.g},${color.b})`,
      'data-opacity': options.opacity || 1.0,
      'data-visible': options.visible !== false ? 'true' : 'false',
      'data-layer-type': 'vector',
      'data-locked': options.locked ? 'true' : 'false',
      'data-blend-mode': options.blendMode || 'normal',
      'data-created': new Date().toISOString(),
      'data-software': 'SVG Wizard',
      'data-software-version': '4.0.0'
    };
    
    // 追加のカスタム属性
    if (options.customAttributes) {
      Object.assign(attributes, options.customAttributes);
    }
    
    // Photopea特有の拡張属性
    attributes['data-pp-layer-type'] = 'shape';
    attributes['data-pp-layer-data'] = JSON.stringify({
      name: layerName,
      id: layerId,
      type: 'shape',
      color: [color.r, color.g, color.b],
      opacity: options.opacity || 1.0,
      visible: options.visible !== false,
      locked: options.locked || false,
      blendMode: options.blendMode || 'normal'
    });
    
    return attributes;
  }
  
  /**
   * 物体認識ベースのSVGを生成します
   * @param {ImageData} imageData - 処理する画像データ
   * @param {Object} options - 変換オプション
   * @returns {Object} SVGデータとレイヤー情報を含むオブジェクト
   */
  function generateObjectBasedSVG(imageData, options = {}) {
    // デフォルトオプション
    const defaults = {
      edgeThreshold: 30,
      minSegmentSize: 100,
      maxSegments: 24,
      simplify: 0.5,
      photopeaCompat: true,
      illustratorCompat: true,
      universalLayerCompat: true
    };
    
    // オプションをマージ
    options = Object.assign({}, defaults, options);
    
    try {
      // エッジ検出
      const edgeData = detectEdges(imageData, options.edgeThreshold);
      
      // 画像のセグメント化
      const segments = segmentImage(imageData, edgeData, options.minSegmentSize);
      
      // セグメント数を制限
      const segmentCount = Math.min(segments.maxId + 1, options.maxSegments);
      
      // セグメントごとの代表色を計算
      const segmentColors = calculateSegmentColors(imageData, segments, segmentCount);
      
      // オブジェクト情報を抽出
      const objects = extractObjectsWithColors(imageData, {
        segments: segments,
        segmentColors: segmentColors,
        segmentCount: segmentCount,
        minSize: options.minSegmentSize
      });
      
      // オブジェクト名を推測
      const namedObjects = inferObjectNames(objects, imageData.width, imageData.height);
      
      // レイヤー情報を作成
      const layers = [];
      
      // Potraceが利用可能かチェック
      const potraceAvailable = typeof window.Potrace !== 'undefined';
      
      // 一時キャンバス
      const canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      
      // 各オブジェクトをトレース
      for (let i = 0; i < namedObjects.length; i++) {
        const obj = namedObjects[i];
        
        // マスク画像を作成
        const maskData = createSegmentMask(segments, imageData.width, imageData.height, obj.id);
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
            const pathMatches = svgData.match(/<path[^>]*>/g);
            
            if (pathMatches && pathMatches.length > 0) {
              svgPaths = pathMatches.join('');
            }
          } catch (error) {
            console.error(`オブジェクト ${i} のトレースに失敗しました:`, error);
            
            // フォールバック: Base64画像を使用
            const dataURL = canvas.toDataURL('image/png', 0.8);
            svgPaths = `<image width="${imageData.width}" height="${imageData.height}" href="${dataURL}" />`;
          }
        } else {
          // Potraceが利用できない場合はBase64画像を使用
          const dataURL = canvas.toDataURL('image/png', 0.8);
          svgPaths = `<image width="${imageData.width}" height="${imageData.height}" href="${dataURL}" />`;
        }
        
        // 色情報
        const color = obj.color;
        const colorHex = rgbToHex(color[0], color[1], color[2]);
        
        // レイヤー名
        const layerName = obj.name || `オブジェクト ${i + 1}`;
        
        // レイヤーID
        const layerId = `object_${i}`;
        
        // Photopea互換属性
        const photopeaAttrs = options.photopeaCompat ? 
          createPhotopeaLayerAttributes(layerId, layerName, {r: color[0], g: color[1], b: color[2]}) : {};
        
        // レイヤー情報を追加
        layers.push({
          id: layerId,
          name: layerName,
          content: svgPaths,
          pathData: svgPaths,
          color: colorHex,
          visible: true,
          photopeaAttributes: photopeaAttrs,
          objectData: {
            id: obj.id,
            area: obj.area,
            bounds: obj.bounds,
            type: obj.type
          }
        });
      }
      
      // SVGを生成
      let svgData;
      
      if (options.photopeaCompat) {
        // Photopea互換SVG
        svgData = _generatePhotopeaCompatSVG(layers, imageData.width, imageData.height, options);
      } else if (options.universalLayerCompat) {
        // 汎用レイヤー互換SVG
        svgData = _generateLayeredSVG(layers, imageData.width, imageData.height, options);
      } else if (options.illustratorCompat) {
        // Illustrator互換SVG（外部モジュールに依存）
        if (typeof window.ImageTracerLayers !== 'undefined' && 
            typeof window.ImageTracerLayers.createAICompatSVG === 'function') {
          svgData = window.ImageTracerLayers.createAICompatSVG(layers, imageData.width, imageData.height, options);
        } else {
          // フォールバック
          svgData = _generateLayeredSVG(layers, imageData.width, imageData.height, options);
        }
      } else {
        // 標準SVG
        svgData = _generateStandardSVG(layers, imageData.width, imageData.height);
      }
      
      return {
        svgData: svgData,
        layers: layers,
        objects: namedObjects,
        width: imageData.width,
        height: imageData.height
      };
    } catch (error) {
      console.error('物体認識ベースのSVG生成に失敗しました:', error);
      
      // フォールバック: 基本的なSVGを返す
      const fallbackSvg = createFallbackSVG(
        imageData.width, 
        imageData.height, 
        '物体認識に失敗しました: ' + error.message
      );
      
      return {
        svgData: fallbackSvg,
        layers: [],
        objects: [],
        width: imageData.width,
        height: imageData.height
      };
    }
  }
  
  /**
   * Photopea互換のSVGを生成します
   * @param {Array} layers - レイヤー情報の配列
   * @param {number} width - SVGの幅
   * @param {number} height - SVGの高さ
   * @param {Object} options - 追加オプション
   * @returns {string} SVGデータ
   * @private
   */
  function _generatePhotopeaCompatSVG(layers, width, height, options = {}) {
    // SVGヘッダー
    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     xmlns:photopea="http://www.photopea.com"
     width="${width}" 
     height="${height}" 
     viewBox="0 0 ${width} ${height}"
     version="1.1"
     data-photopea-document="true"
     data-photopea-version="4.0.0"
     data-created="${new Date().toISOString()}"
     data-software="SVG Wizard">
  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
             xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
             xmlns:dc="http://purl.org/dc/elements/1.1/"
             xmlns:photopea="http://www.photopea.com/rdf#">
      <rdf:Description rdf:about="">
        <dc:format>image/svg+xml</dc:format>
        <dc:title>SVG Wizard Output</dc:title>
        <dc:creator>SVG Wizard</dc:creator>
        <dc:description>Generated by SVG Wizard</dc:description>
        <photopea:layerCount>${layers.length}</photopea:layerCount>
        <photopea:documentWidth>${width}</photopea:documentWidth>
        <photopea:documentHeight>${height}</photopea:documentHeight>
      </rdf:Description>
    </rdf:RDF>
  </metadata>
  
  <!-- Photopea Document Structure -->
  <g id="document" data-photopea-root="true" data-name="Document">`;
  
  // レイヤーを追加（逆順で追加して正しい重ね順にする）
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    
    // 表示/非表示スタイル
    const visibilityStyle = layer.visible ? '' : 'display:none;';
    
    // Photopea属性を文字列に変換
    let photopeaAttrsStr = '';
    if (layer.photopeaAttributes) {
      for (const [key, value] of Object.entries(layer.photopeaAttributes)) {
        photopeaAttrsStr += ` ${key}="${value}"`;
      }
    }
    
    // レイヤーを追加
    svg += `
    <g id="${layer.id}" data-name="${layer.name}" style="${visibilityStyle}" fill="${layer.color}"${photopeaAttrsStr}>
      ${layer.content}
    </g>`;
  }
  
  // SVGフッター
  svg += `
  </g>
</svg>`;
  
  return svg;
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
    createFallbackSVG: createFallbackSVG,
    
    // 新しい物体認識とレイヤー分離API
    detectEdges: detectEdges,
    segmentImage: segmentImage,
    calculateSegmentColors: calculateSegmentColors,
    createSegmentMask: createSegmentMask,
    extractObjectsWithColors: extractObjectsWithColors,
    inferObjectNames: inferObjectNames,
    rgbToHex: rgbToHex,
    getColorName: getColorName,
    createPhotopeaLayerAttributes: createPhotopeaLayerAttributes,
    generateLayeredSVG: _generateLayeredSVG,
    generateObjectBasedSVG: generateObjectBasedSVG
  };
})(); 