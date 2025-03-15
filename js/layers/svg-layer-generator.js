/**
 * SVGレイヤー生成モジュール
 * 
 * このモジュールは画像データからSVGレイヤーを生成するための機能を提供します。
 * 色や形状に基づいて効率的にレイヤーを分割し、各グラフィック要素を適切にグループ化します。
 * 
 * @version 1.0.0
 * @author SVG Wizard Team
 */

// SVGレイヤージェネレーターの名前空間
const SVGLayerGenerator = (function() {
  /**
   * 色量子化設定
   * @type {Object}
   */
  const DEFAULT_COLOR_OPTIONS = {
    maxColors: 36,        // 最大色数
    colorSpace: 'rgb',    // 色空間（rgb, lab, hsv）
    colorDistance: 'euclidean', // 色距離計算方法
    colorReduction: 'kmeans',   // 色削減アルゴリズム
    colorImportance: [3, 6, 1], // RGB各要素の重要度
    minColorArea: 50      // 最小の色領域サイズ（ピクセル）
  };

  /**
   * エッジ検出設定
   * @type {Object}
   */
  const DEFAULT_EDGE_OPTIONS = {
    threshold: 20,        // エッジ検出閾値
    simplification: 0.5,  // パス単純化レベル
    strokeWidth: 0,       // 線の太さ
    cornerThreshold: 80,  // 角度閾値
    maxSegments: 48,      // 最大セグメント数
    minPathLength: 5      // 最小パス長
  };

  /**
   * レイヤー設定
   * @type {Object}
   */
  const DEFAULT_LAYER_OPTIONS = {
    naming: 'color',      // レイヤー命名方法（color, auto, index）
    prefix: 'layer_',     // レイヤー名プレフィックス
    illustratorCompat: true,  // Illustrator互換モード
    photopeaCompat: true,     // Photopea互換モード
    universalLayerCompat: true, // 汎用レイヤー互換モード
    forceSeparateLayers: true,  // 強制的にレイヤーを分割
    nestedGroups: true         // 入れ子グループの使用
  };

  /**
   * 画像から色とエッジ情報を抽出する
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 処理オプション
   * @returns {Object} 抽出された色とエッジ情報
   */
  function extractColorAndEdgeInfo(imageData, options) {
    const colorOptions = { ...DEFAULT_COLOR_OPTIONS, ...options };
    const width = imageData.width;
    const height = imageData.height;
    const pixels = imageData.data;
    
    // 色の量子化処理（K-means法）
    const colors = quantizeColors(pixels, colorOptions);
    
    // 色ごとのピクセルマップを生成
    const colorMaps = createColorMaps(pixels, colors, width, height);
    
    // エッジ検出処理
    const edges = detectEdges(pixels, width, height, options.edgeThreshold || DEFAULT_EDGE_OPTIONS.threshold);
    
    return {
      colors: colors,
      colorMaps: colorMaps,
      edges: edges,
      width: width,
      height: height
    };
  }

  /**
   * 色を量子化する（類似色をグループ化）
   * @param {Uint8ClampedArray} pixels - ピクセルデータ
   * @param {Object} options - 量子化オプション
   * @returns {Array} 抽出された代表色の配列
   */
  function quantizeColors(pixels, options) {
    const maxColors = options.maxColors || 64; // デフォルト値を増加
    const result = [];
    const colorCounts = {};
    const totalPixels = pixels.length / 4;
    
    console.log(`色の量子化を開始: 最大 ${maxColors} 色を検出します`);
    
    // すべてのピクセルをスキャンして色の出現回数をカウント
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i+3] < 128) continue; // 透明ピクセルはスキップ
      
      // RGBの重み付け
      const r = pixels[i] * (options.colorImportance ? options.colorImportance[0] : 1);
      const g = pixels[i+1] * (options.colorImportance ? options.colorImportance[1] : 1);
      const b = pixels[i+2] * (options.colorImportance ? options.colorImportance[2] : 1);
      
      // より細かい量子化（色の分解能を上げる）
      const qFactor = options.detailBoost ? 4 : 8; // detail boostがある場合は分解能を上げる
      const qr = Math.floor(r / qFactor) * qFactor;
      const qg = Math.floor(g / qFactor) * qFactor;
      const qb = Math.floor(b / qFactor) * qFactor;
      
      const colorKey = `${qr},${qg},${qb}`;
      
      if (!colorCounts[colorKey]) {
        colorCounts[colorKey] = {
          r: pixels[i],
          g: pixels[i+1],
          b: pixels[i+2],
          count: 0,
          // 色の特性を記録（後でクラスタリングに使用）
          sum_r: 0,
          sum_g: 0,
          sum_b: 0
        };
      }
      
      // 正確な色の累積をとる（平均を計算するため）
      colorCounts[colorKey].count++;
      colorCounts[colorKey].sum_r += pixels[i];
      colorCounts[colorKey].sum_g += pixels[i+1];
      colorCounts[colorKey].sum_b += pixels[i+2];
    }
    
    // 出現回数でソートして上位の色を取得
    const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);
    
    // 各色について平均値を計算（より正確な代表色を得るため）
    sortedColors.forEach(color => {
      if (color.count > 0) {
        color.r = Math.round(color.sum_r / color.count);
        color.g = Math.round(color.sum_g / color.count);
        color.b = Math.round(color.sum_b / color.count);
      }
    });
    
    // 最小エリアサイズ（面積比率）
    const minAreaRatio = (options.minColorArea || 0.5) / 100;
    const minPixelCount = Math.max(10, Math.floor(totalPixels * minAreaRatio));
    
    console.log(`最小ピクセル数: ${minPixelCount} (全 ${totalPixels} ピクセル中)`);
    
    // 十分な出現数を持つ色のみをフィルタリング
    const significantColors = sortedColors.filter(color => color.count >= minPixelCount);
    
    console.log(`重要な色の数: ${significantColors.length}`);
    
    // K-means法による色のクラスタリング
    if (options.colorReduction === 'kmeans' && significantColors.length > maxColors) {
      return kMeansColorClustering(significantColors, maxColors, options);
    }
    
    // 単純な上位N色の取得
    const dominantColors = significantColors.slice(0, maxColors);
    
    // 色の情報を整形して返却
    return dominantColors.map((color, index) => ({
      r: color.r,
      g: color.g,
      b: color.b,
      count: color.count,
      hex: rgbToHex(color.r, color.g, color.b),
      id: `color_${index + 1}` // インデックスを1から開始
    }));
  }

  /**
   * K-means法による色のクラスタリング
   * @param {Array} colors - 色データの配列
   * @param {number} k - クラスタ数（生成する色の数）
   * @param {Object} options - オプション
   * @returns {Array} クラスタリングされた色の配列
   */
  function kMeansColorClustering(colors, k, options) {
    console.log(`K-means色クラスタリングを開始: ${colors.length}色を${k}クラスタに`);
    
    // 初期クラスタ中心を選択（k-means++アルゴリズム）
    const centroids = [];
    
    // 最初のセントロイドをランダムに選択
    const firstIndex = Math.floor(Math.random() * colors.length);
    centroids.push({
      r: colors[firstIndex].r,
      g: colors[firstIndex].g,
      b: colors[firstIndex].b
    });
    
    // 残りのセントロイドを選択
    for (let i = 1; i < k; i++) {
      // 各点から最も近いセントロイドまでの距離の二乗を計算
      const distances = colors.map(color => {
        let minDist = Infinity;
        for (const centroid of centroids) {
          const dr = color.r - centroid.r;
          const dg = color.g - centroid.g;
          const db = color.b - centroid.b;
          const dist = dr*dr + dg*dg + db*db;
          minDist = Math.min(minDist, dist);
        }
        return minDist;
      });
      
      // 距離に比例する確率で次のセントロイドを選択
      const totalDist = distances.reduce((sum, dist) => sum + dist, 0);
      let target = Math.random() * totalDist;
      let cumulativeDist = 0;
      let nextCentroidIndex = 0;
      
      for (let j = 0; j < distances.length; j++) {
        cumulativeDist += distances[j];
        if (cumulativeDist >= target) {
          nextCentroidIndex = j;
          break;
        }
      }
      
      centroids.push({
        r: colors[nextCentroidIndex].r,
        g: colors[nextCentroidIndex].g,
        b: colors[nextCentroidIndex].b
      });
    }
    
    // 最大イテレーション数
    const maxIterations = 10;
    let iterations = 0;
    let changed = true;
    
    // クラスタ割り当て
    const assignments = new Array(colors.length).fill(0);
    
    // メインループ
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      // 各色を最も近いセントロイドに割り当て
      for (let i = 0; i < colors.length; i++) {
        const color = colors[i];
        let minDist = Infinity;
        let newCluster = 0;
        
        for (let j = 0; j < centroids.length; j++) {
          const centroid = centroids[j];
          const dr = color.r - centroid.r;
          const dg = color.g - centroid.g;
          const db = color.b - centroid.b;
          const dist = dr*dr + dg*dg + db*db;
          
          if (dist < minDist) {
            minDist = dist;
            newCluster = j;
          }
        }
        
        if (assignments[i] !== newCluster) {
          assignments[i] = newCluster;
          changed = true;
        }
      }
      
      // セントロイドを更新
      for (let j = 0; j < centroids.length; j++) {
        let sum_r = 0, sum_g = 0, sum_b = 0, count = 0;
        
        for (let i = 0; i < colors.length; i++) {
          if (assignments[i] === j) {
            sum_r += colors[i].r * colors[i].count;
            sum_g += colors[i].g * colors[i].count;
            sum_b += colors[i].b * colors[i].count;
            count += colors[i].count;
          }
        }
        
        if (count > 0) {
          centroids[j] = {
            r: Math.round(sum_r / count),
            g: Math.round(sum_g / count),
            b: Math.round(sum_b / count)
          };
        }
      }
      
      console.log(`K-means反復 ${iterations}: ${changed ? '変更あり' : '収束'}`);
    }
    
    // 最終結果の生成
    const result = [];
    
    for (let j = 0; j < centroids.length; j++) {
      let count = 0;
      
      // このクラスタに割り当てられた色のカウントを合計
      for (let i = 0; i < colors.length; i++) {
        if (assignments[i] === j) {
          count += colors[i].count;
        }
      }
      
      if (count > 0) {
        result.push({
          r: centroids[j].r,
          g: centroids[j].g,
          b: centroids[j].b,
          count: count,
          hex: rgbToHex(centroids[j].r, centroids[j].g, centroids[j].b),
          id: `color_${j + 1}`
        });
      }
    }
    
    // カウントでソート
    return result.sort((a, b) => b.count - a.count);
  }

  /**
   * 色ごとのピクセルマップを作成
   * @param {Uint8ClampedArray} pixels - ピクセルデータ
   * @param {Array} colors - 量子化された色の配列
   * @param {number} width - 画像の幅
   * @param {number} height - 画像の高さ
   * @returns {Object} 色ごとのピクセルマップ
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
   * エッジを検出する
   * @param {Uint8ClampedArray} pixels - ピクセルデータ
   * @param {number} width - 画像の幅
   * @param {number} height - 画像の高さ
   * @param {number} threshold - エッジ検出閾値
   * @returns {Uint8Array} エッジマップ
   */
  function detectEdges(pixels, width, height, threshold) {
    const edgeMap = new Uint8Array(width * height);
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    // グレースケールに変換
    const grayscale = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        grayscale[y * width + x] = Math.round(
          pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114
        );
      }
    }
    
    // Sobelフィルタを適用
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        
        // 3x3カーネルを適用
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixel = grayscale[(y + ky) * width + (x + kx)];
            const kidx = (ky + 1) * 3 + (kx + 1);
            
            gx += pixel * sobelX[kidx];
            gy += pixel * sobelY[kidx];
          }
        }
        
        // エッジの強さを計算
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        
        // 閾値より大きい場合はエッジとして記録
        if (magnitude > threshold) {
          edgeMap[y * width + x] = 1;
        }
      }
    }
    
    return edgeMap;
  }

  /**
   * 色のマップからパスを生成する
   * @param {Uint8Array} colorMap - 色ごとのピクセルマップ
   * @param {number} width - 画像の幅
   * @param {number} height - 画像の高さ
   * @param {Object} options - パス生成オプション
   * @returns {Array} SVGパスの配列
   */
  function generatePathsFromColorMap(colorMap, width, height, options) {
    const simplification = options.simplification || DEFAULT_EDGE_OPTIONS.simplification;
    const paths = [];
    
    // 訪問済みピクセルを追跡
    const visited = new Uint8Array(width * height);
    
    // 連結領域を見つけてパスに変換
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        // このピクセルが色のマップに含まれており、まだ訪問していない場合
        if (colorMap[idx] === 1 && visited[idx] === 0) {
          const contour = traceContour(colorMap, visited, x, y, width, height);
          
          // 輪郭が十分な長さを持つ場合
          if (contour.length >= options.minPathLength || DEFAULT_EDGE_OPTIONS.minPathLength) {
            // 輪郭を単純化
            const simplified = simplifyPath(contour, simplification);
            
            // SVGパス文字列を生成
            const pathData = contourToPathData(simplified);
            paths.push(pathData);
          }
        }
      }
    }
    
    return paths;
  }

  /**
   * 輪郭をトレースする
   * @param {Uint8Array} colorMap - 色ごとのピクセルマップ
   * @param {Uint8Array} visited - 訪問済みマップ
   * @param {number} startX - 開始X座標
   * @param {number} startY - 開始Y座標
   * @param {number} width - 画像の幅
   * @param {number} height - 画像の高さ
   * @returns {Array} 輪郭点の配列
   */
  function traceContour(colorMap, visited, startX, startY, width, height) {
    const contour = [];
    const queue = [{x: startX, y: startY}];
    const directions = [
      {dx: 0, dy: -1}, // 上
      {dx: 1, dy: 0},  // 右
      {dx: 0, dy: 1},  // 下
      {dx: -1, dy: 0}  // 左
    ];
    
    // 境界点を見つける
    while (queue.length > 0) {
      const point = queue.shift();
      const idx = point.y * width + point.x;
      
      // すでに訪問済みならスキップ
      if (visited[idx] === 1) continue;
      
      // 訪問済みとしてマーク
      visited[idx] = 1;
      
      // 境界点かどうかを判定
      let isBoundary = false;
      
      for (const dir of directions) {
        const nx = point.x + dir.dx;
        const ny = point.y + dir.dy;
        
        // 画像の範囲内かチェック
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          
          // 隣接ピクセルが色のマップに含まれていなければ境界点
          if (colorMap[nidx] === 0) {
            isBoundary = true;
          } else if (visited[nidx] === 0) {
            // まだ訪問していない同じ色の領域をキューに追加
            queue.push({x: nx, y: ny});
          }
        } else {
          // 画像の外側に接していれば境界点
          isBoundary = true;
        }
      }
      
      // 境界点なら輪郭に追加
      if (isBoundary) {
        contour.push({x: point.x, y: point.y});
      }
    }
    
    return contour;
  }

  /**
   * パスを単純化する
   * @param {Array} points - 点の配列
   * @param {number} tolerance - 単純化の許容誤差
   * @returns {Array} 単純化された点の配列
   */
  function simplifyPath(points, tolerance) {
    if (points.length <= 2) return points;
    
    // Douglas-Peucker アルゴリズムを使用してパスを単純化
    const firstPoint = 0;
    const lastPoint = points.length - 1;
    const simplified = [points[firstPoint]];
    
    simplifyDouglasPeucker(points, firstPoint, lastPoint, tolerance, simplified);
    
    // 最後の点を追加（まだ追加されていない場合）
    if (simplified.length === 1 || simplified[simplified.length - 1] !== points[lastPoint]) {
      simplified.push(points[lastPoint]);
    }
    
    return simplified;
  }

  /**
   * Douglas-Peucker アルゴリズムによるパス単純化の実装
   * @param {Array} points - 点の配列
   * @param {number} first - 最初の点のインデックス
   * @param {number} last - 最後の点のインデックス
   * @param {number} tolerance - 許容誤差
   * @param {Array} result - 結果を格納する配列
   */
  function simplifyDouglasPeucker(points, first, last, tolerance, result) {
    // 直線から最も遠い点を見つける
    let maxDistance = 0;
    let maxIndex = 0;
    
    const line = {
      x1: points[first].x,
      y1: points[first].y,
      x2: points[last].x,
      y2: points[last].y
    };
    
    for (let i = first + 1; i < last; i++) {
      const distance = pointToLineDistance(points[i], line);
      
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    // 許容誤差より大きい場合は再帰的に処理
    if (maxDistance > tolerance) {
      simplifyDouglasPeucker(points, first, maxIndex, tolerance, result);
      result.push(points[maxIndex]);
      simplifyDouglasPeucker(points, maxIndex, last, tolerance, result);
    }
  }

  /**
   * 点から直線への距離を計算
   * @param {Object} point - 点の座標
   * @param {Object} line - 直線の座標
   * @returns {number} 距離
   */
  function pointToLineDistance(point, line) {
    const x0 = point.x;
    const y0 = point.y;
    const x1 = line.x1;
    const y1 = line.y1;
    const x2 = line.x2;
    const y2 = line.y2;
    
    // 2点間の距離
    const lineLength = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
    
    if (lineLength === 0) return Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
    
    // 直線から点への距離を計算
    const t = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / (lineLength * lineLength);
    
    if (t < 0) {
      return Math.sqrt((x0 - x1) * (x0 - x1) + (y0 - y1) * (y0 - y1));
    }
    if (t > 1) {
      return Math.sqrt((x0 - x2) * (x0 - x2) + (y0 - y2) * (y0 - y2));
    }
    
    const projectionX = x1 + t * (x2 - x1);
    const projectionY = y1 + t * (y2 - y1);
    
    return Math.sqrt((x0 - projectionX) * (x0 - projectionX) + (y0 - projectionY) * (y0 - projectionY));
  }

  /**
   * 輪郭からSVGパスデータ文字列を生成
   * @param {Array} contour - 輪郭点の配列
   * @returns {string} SVGパスデータ文字列
   */
  function contourToPathData(contour) {
    if (contour.length === 0) return '';
    
    let pathData = `M ${contour[0].x},${contour[0].y}`;
    
    for (let i = 1; i < contour.length; i++) {
      pathData += ` L ${contour[i].x},${contour[i].y}`;
    }
    
    // 閉じたパスにする
    pathData += ' Z';
    
    return pathData;
  }

  /**
   * RGB値から16進数カラーコードを生成
   * @param {number} r - 赤成分 (0-255)
   * @param {number} g - 緑成分 (0-255)
   * @param {number} b - 青成分 (0-255)
   * @returns {string} 16進数カラーコード
   */
  function rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /**
   * レイヤー情報からSVG文字列を生成
   * @param {Object} info - 色とエッジ情報
   * @param {Object} options - レイヤーオプション
   * @returns {string} SVG文字列
   */
  function generateSVGFromLayers(info, options) {
    const layerOptions = { ...DEFAULT_LAYER_OPTIONS, ...options };
    const width = info.width;
    const height = info.height;
    const colors = info.colors;
    const svgParts = [];
    
    // SVGヘッダーを生成
    const svgHeader = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    svgParts.push(svgHeader);
    
    // SVGのメタデータを追加
    svgParts.push(`  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description>
        <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">SVG Wizard Generated Image</dc:title>
        <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">SVG Wizard</dc:creator>
        <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">Automatically generated SVG with multiple layers</dc:description>
      </rdf:Description>
    </rdf:RDF>
  </metadata>`);
    
    // Photopea互換レイヤーのルートグループを生成
    if (layerOptions.photopeaCompat || layerOptions.universalLayerCompat) {
      svgParts.push(`  <g id="Layers" data-photopea-root="true">`);
    } else {
      svgParts.push(`  <g id="Layers">`);
    }
    
    // 各色のレイヤーを生成
    for (let i = colors.length - 1; i >= 0; i--) {
      const color = colors[i];
      const colorMap = info.colorMaps[color.id];
      let layerName;
      
      // レイヤー名の決定
      switch (layerOptions.naming) {
        case 'color':
          layerName = `${layerOptions.prefix}${color.hex.substring(1)}`;
          break;
        case 'index':
          layerName = `${layerOptions.prefix}${i + 1}`;
          break;
        default: // 'auto'
          layerName = `${layerOptions.prefix}${i + 1}_${color.hex.substring(1)}`;
          break;
      }
      
      // レイヤーのグループを開始
      let layerAttrs = '';
      
      if (layerOptions.photopeaCompat) {
        layerAttrs = ` id="${layerName}" data-photopea-layer="true" data-layer-name="${layerName}" style="fill:${color.hex};"`;
      } else if (layerOptions.illustratorCompat) {
        layerAttrs = ` id="${layerName}" data-name="${layerName}" style="fill:${color.hex};"`;
      } else {
        layerAttrs = ` id="${layerName}" style="fill:${color.hex};"`;
      }
      
      svgParts.push(`    <g${layerAttrs}>`);
      
      // この色のパスを生成
      const paths = generatePathsFromColorMap(colorMap, width, height, options);
      
      // パスをSVGに追加
      for (let j = 0; j < paths.length; j++) {
        const pathId = `${layerName}_path_${j + 1}`;
        const pathAttrs = layerOptions.strokeWidth > 0 
          ? ` id="${pathId}" stroke="black" stroke-width="${layerOptions.strokeWidth}" fill="${color.hex}"`
          : ` id="${pathId}" fill="${color.hex}"`;
        
        svgParts.push(`      <path${pathAttrs} d="${paths[j]}"/>`);
      }
      
      // レイヤーのグループを終了
      svgParts.push(`    </g>`);
    }
    
    // レイヤーのルートグループを終了
    svgParts.push(`  </g>`);
    
    // SVGの終了タグ
    svgParts.push(`</svg>`);
    
    return svgParts.join('\n');
  }

  /**
   * 画像データからレイヤー分割されたSVGを生成
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @returns {string} 生成されたSVG文字列
   */
  function convertImageDataToLayeredSVG(imageData, options) {
    // 色とエッジの情報を抽出
    const info = extractColorAndEdgeInfo(imageData, options);
    
    // SVGを生成
    return generateSVGFromLayers(info, options);
  }

  /**
   * HTMLキャンバスからレイヤー分割されたSVGを生成
   * @param {HTMLCanvasElement} canvas - キャンバス要素
   * @param {Object} options - 変換オプション
   * @returns {string} 生成されたSVG文字列
   */
  function convertCanvasToLayeredSVG(canvas, options) {
    console.log('SVGLayerGenerator.convertCanvasToLayeredSVG: 開始');
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // レイヤーデータがオプションで提供されているか確認
    if (options.layerData && Array.isArray(options.layerData) && options.layerData.length > 0) {
      console.log(`渡されたレイヤーデータを使用: ${options.layerData.length}レイヤー`);
      return generateSVGWithProvidedLayers(imageData, options.layerData, options);
    }
    
    // 通常のフロー: 内部でレイヤーを生成
    console.log('内部レイヤー生成処理を実行');
    const result = convertImageDataToLayeredSVG(imageData, options);
    
    // 生成されたSVGにレイヤーが含まれているか確認
    const layerCount = (result.match(/<g[^>]*id="layer_/g) || []).length;
    console.log(`生成されたレイヤー数: ${layerCount}`);
    
    // レイヤーが生成されなかった場合は強制的にレイヤーを作成
    if (layerCount === 0 && options.forceSeparateLayers) {
      console.log('レイヤーが見つからないため強制レイヤー生成を実行');
      return generateForcedLayersSVG(imageData, options);
    }
    
    return result;
  }

  /**
   * 提供されたレイヤーデータを使用してSVGを生成
   * @param {ImageData} imageData - 画像データ
   * @param {Array} layerData - レイヤーデータの配列
   * @param {Object} options - 変換オプション
   * @returns {string} SVG文字列
   */
  function generateSVGWithProvidedLayers(imageData, layerData, options) {
    const width = imageData.width;
    const height = imageData.height;
    const svgParts = [];
    
    // SVGヘッダーを生成
    const svgHeader = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    svgParts.push(svgHeader);
    
    // SVGのメタデータを追加
    svgParts.push(`  <metadata>
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
      <rdf:Description>
        <dc:title xmlns:dc="http://purl.org/dc/elements/1.1/">SVG Wizard Generated Image</dc:title>
        <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">SVG Wizard</dc:creator>
        <dc:description xmlns:dc="http://purl.org/dc/elements/1.1/">Automatically generated SVG with multiple layers</dc:description>
      </rdf:Description>
    </rdf:RDF>
  </metadata>`);
    
    // レイヤーオプションを設定
    const layerOptions = { ...DEFAULT_LAYER_OPTIONS, ...options };
    
    // Photopea互換レイヤーのルートグループを生成
    if (layerOptions.photopeaCompat || layerOptions.universalLayerCompat) {
      svgParts.push(`  <g id="Layers" data-photopea-root="true">`);
    } else {
      svgParts.push(`  <g id="Layers">`);
    }
    
    // 各レイヤーを生成
    for (let i = 0; i < layerData.length; i++) {
      const layer = layerData[i];
      const layerId = layer.id || `layer_${i + 1}`;
      const layerName = layer.name || layerId;
      const layerColor = layer.color || '#000000';
      
      // レイヤーのグループを開始
      let layerAttrs = '';
      
      if (layerOptions.photopeaCompat) {
        layerAttrs = ` id="${layerId}" data-photopea-layer="true" data-layer-name="${layerName}" style="fill:${layerColor};"`;
      } else if (layerOptions.illustratorCompat) {
        layerAttrs = ` id="${layerId}" data-name="${layerName}" style="fill:${layerColor};"`;
      } else {
        layerAttrs = ` id="${layerId}" style="fill:${layerColor};"`;
      }
      
      svgParts.push(`    <g${layerAttrs}>`);
      
      // レイヤーのパスを追加
      if (layer.paths && layer.paths.length > 0) {
        for (let j = 0; j < layer.paths.length; j++) {
          const pathId = `${layerId}_path_${j + 1}`;
          const pathData = layer.paths[j];
          const pathAttrs = layerOptions.strokeWidth > 0 
            ? ` id="${pathId}" stroke="black" stroke-width="${layerOptions.strokeWidth}" fill="${layerColor}"`
            : ` id="${pathId}" fill="${layerColor}"`;
          
          svgParts.push(`      <path${pathAttrs} d="${pathData}"/>`);
        }
      }
      
      // レイヤーのグループを終了
      svgParts.push(`    </g>`);
    }
    
    // レイヤーのルートグループを終了
    svgParts.push(`  </g>`);
    
    // SVGの終了タグ
    svgParts.push(`</svg>`);
    
    return svgParts.join('\n');
  }

  /**
   * 強制的にレイヤーを生成してSVGを作成
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - 変換オプション
   * @returns {string} SVG文字列
   */
  function generateForcedLayersSVG(imageData, options) {
    console.log('強制レイヤー生成処理の実行');
    
    // 強制的に色検出オプションを調整
    const enhancedOptions = {
      ...options,
      maxColors: Math.max(options.colorQuantization || 64, 24),
      detailBoost: true,
      minColorArea: 5, // より小さな色エリアも検出
      colorThreshold: 8 // 色類似性の閾値を下げる
    };
    
    // 拡張色検出で色情報を抽出
    const colorInfo = extractColorAndEdgeInfo(imageData, enhancedOptions);
    
    // 生成した色情報からレイヤーデータを作成
    const forcedLayers = [];
    
    if (colorInfo && colorInfo.colors) {
      for (let i = 0; i < colorInfo.colors.length; i++) {
        const color = colorInfo.colors[i];
        
        // 色マップからパスを生成
        let paths = [];
        if (colorInfo.colorMaps && colorInfo.colorMaps[color.id]) {
          paths = generatePathsFromColorMap(
            colorInfo.colorMaps[color.id],
            colorInfo.width,
            colorInfo.height,
            enhancedOptions
          );
        }
        
        // パスが生成できた場合のみレイヤーに追加
        if (paths && paths.length > 0) {
          forcedLayers.push({
            id: color.id,
            name: `layer_${color.hex.substring(1)}`,
            color: color.hex,
            paths: paths
          });
        }
      }
    }
    
    console.log(`強制レイヤー生成結果: ${forcedLayers.length}レイヤー`);
    
    // 生成したレイヤーデータでSVGを作成
    if (forcedLayers.length > 0) {
      return generateSVGWithProvidedLayers(imageData, forcedLayers, options);
    }
    
    // それでも失敗する場合はシンプルなレイヤーを1つ作成
    console.log('強制レイヤー生成も失敗。単一レイヤーのSVGを作成');
    const singleLayer = createSingleLayerFallback(imageData, options);
    return generateSVGWithProvidedLayers(imageData, [singleLayer], options);
  }

  /**
   * 単一レイヤーのフォールバックを作成
   * @param {ImageData} imageData - 画像データ
   * @param {Object} options - オプション
   * @returns {Object} レイヤーデータ
   */
  function createSingleLayerFallback(imageData, options) {
    const width = imageData.width;
    const height = imageData.height;
    
    // 画像全体を覆う矩形パス
    const rectPath = `M 0,0 L ${width},0 L ${width},${height} L 0,${height} Z`;
    
    return {
      id: "layer_main",
      name: "main_layer",
      color: "#000000",
      paths: [rectPath]
    };
  }

  /**
   * 文字列からSVGレイヤー情報を抽出
   * @param {string} svgString - SVG文字列
   * @returns {Array} レイヤー情報の配列
   */
  function extractLayersFromSVG(svgString) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const layerGroups = svgDoc.querySelectorAll('g[id^="layer_"], g[data-photopea-layer="true"], g[data-name]');
    const layers = [];
    
    layerGroups.forEach((group, index) => {
      const id = group.getAttribute('id');
      const name = group.getAttribute('data-layer-name') || 
                  group.getAttribute('data-name') || 
                  id || 
                  `レイヤー ${index + 1}`;
      
      // 色の取得
      let color = '#000000';
      const style = group.getAttribute('style');
      if (style) {
        const fillMatch = style.match(/fill:\s*([^;]+)/);
        if (fillMatch) {
          color = fillMatch[1];
        }
      }
      
      // 最初のパスからも色を取得（スタイルに色がない場合）
      if (color === '#000000') {
        const firstPath = group.querySelector('path');
        if (firstPath) {
          const pathFill = firstPath.getAttribute('fill');
          if (pathFill) {
            color = pathFill;
          }
        }
      }
      
      layers.push({
        id: id,
        name: name,
        color: color,
        visible: true,
        group: group.outerHTML
      });
    });
    
    return layers;
  }

  // 公開API
  return {
    convertImageDataToLayeredSVG: convertImageDataToLayeredSVG,
    convertCanvasToLayeredSVG: convertCanvasToLayeredSVG,
    extractLayersFromSVG: extractLayersFromSVG,
    
    // 新たに公開する内部API
    extractColorAndEdgeInfo: extractColorAndEdgeInfo,
    generatePathsFromColorMap: generatePathsFromColorMap,
    quantizeColors: quantizeColors,
    createColorMaps: createColorMaps,
    
    // 設定
    DEFAULT_COLOR_OPTIONS: DEFAULT_COLOR_OPTIONS,
    DEFAULT_EDGE_OPTIONS: DEFAULT_EDGE_OPTIONS,
    DEFAULT_LAYER_OPTIONS: DEFAULT_LAYER_OPTIONS
  };
})();

// グローバルスコープに公開
window.SVGLayerGenerator = SVGLayerGenerator; 