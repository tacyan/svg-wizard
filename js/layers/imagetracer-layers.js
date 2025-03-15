/**
 * @module ImageTracerLayers
 * @description SVGのレイヤー管理機能を提供するモジュール
 * @version 3.5.0
 * @license MIT
 * 
 * このモジュールはSVGのレイヤー分離、イラストレーター互換レイヤー構造、
 * レイヤー表示・色変更などの機能を提供します。
 */

// グローバル名前空間にImageTracerLayersを定義
window.ImageTracerLayers = (function() {
  'use strict';
  
  // プライベート変数
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
  const ILLUSTRATOR_NAMESPACE = 'http://ns.adobe.com/AdobeIllustrator/10.0/';
  const GRAPHICS_NAMESPACE = 'http://ns.adobe.com/Graphs/1.0/';
  
  /**
   * SVGレイヤーを作成します
   * @param {Array} colors - 色情報の配列
   * @param {Object} options - オプション設定
   * @returns {Array} レイヤー情報の配列
   */
  function createLayers(colors, options = {}) {
    const layers = [];
    
    // 各色に対してレイヤーを作成
    colors.forEach((color, index) => {
      const layerName = getLayerName(color, index, options.layerNaming);
      const colorHex = rgbToHex(color[0], color[1], color[2]);
      
      layers.push({
        id: 'layer' + index,
        name: layerName,
        color: colorHex,
        index: index,
        visible: true
      });
    });
    
    return layers;
  }
  
  /**
   * レイヤー名を生成します
   * @param {Array} color - 色情報 [R, G, B]
   * @param {number} index - レイヤーインデックス
   * @param {string} namingMode - 命名モード ('color', 'index', 'auto')
   * @returns {string} レイヤー名
   */
  function getLayerName(color, index, namingMode = 'color') {
    // 命名モードに基づいてレイヤー名を決定
    switch (namingMode) {
      case 'color':
        // 色情報からレイヤー名を生成
        const colorHex = rgbToHex(color[0], color[1], color[2]);
        const colorName = colorToName(color);
        return colorName ? `${colorName} (${colorHex})` : `カラー ${colorHex}`;
        
      case 'index':
        // インデックスベースのレイヤー名
        return `レイヤー ${index + 1}`;
        
      case 'auto':
        // グレースケールかどうかで命名方法を変える
        if (isGrayscale(color)) {
          const brightness = Math.round((color[0] + color[1] + color[2]) / 3);
          const percent = Math.round((brightness / 255) * 100);
          return `グレー ${percent}%`;
        } else {
          const colorName = colorToName(color);
          return colorName || `カラー ${index + 1}`;
        }
        
      default:
        // デフォルトはインデックスベース
        return `レイヤー ${index + 1}`;
    }
  }
  
  /**
   * イラストレーター互換のSVGを作成します
   * @param {Array} layers - レイヤー情報の配列
   * @param {number} width - SVG幅
   * @param {number} height - SVG高さ
   * @param {Object} options - オプション設定
   * @returns {string} SVG文字列
   */
  function createAICompatSVG(layers, width, height, options = {}) {
    // SVG基本構造
    let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svg += `<svg xmlns="${SVG_NAMESPACE}" `;
    svg += `xmlns:xlink="http://www.w3.org/1999/xlink" `;
    svg += `xmlns:i="${ILLUSTRATOR_NAMESPACE}" `;
    svg += `xmlns:graph="${GRAPHICS_NAMESPACE}" `;
    svg += `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
    
    // メタデータを追加（イラストレーター互換に必要）
    svg += `<metadata>
  <sfw xmlns="http://ns.adobe.com/SaveForWeb/1.0/">
    <slices/>
    <sliceSourceBounds x="0" y="0" width="${width}" height="${height}" bottomLeftOrigin="true"/>
  </sfw>
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:format>image/svg+xml</dc:format>
      <dc:title>SVG Wizard Generated Image</dc:title>
      <dc:creator>SVG Wizard v${options.version || '3.5.0'}</dc:creator>
      <dc:subject>
        <rdf:Bag>
          <rdf:li>svg</rdf:li>
          <rdf:li>vector</rdf:li>
          <rdf:li>image</rdf:li>
        </rdf:Bag>
      </dc:subject>
    </rdf:Description>
  </rdf:RDF>
</metadata>\n`;
    
    // レイヤーを追加
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const visibility = layer.visible ? 'visible' : 'hidden';
      
      // イラストレーター互換レイヤー
      svg += `<g id="${layer.id}" i:layer="yes" i:dimmedPercent="50" i:rgbTrio="#4F008000FFFF" display="${visibility}">\n`;
      svg += `  <g i:knockout="Off">\n`;
      svg += `    <g i:name="${layer.name}">\n`;
      
      // パスを追加
      if (layer.content) {
        // 直接パスが提供されている場合はそれを使用
        svg += `      ${layer.content.replace(/fill="[^"]*"/, `fill="${layer.color}"`)}\n`;
      } else {
        // ダミーパスを追加
        svg += `      <path fill="${layer.color}" d="M0,0 L0,0 Z"/>\n`;
      }
      
      svg += `    </g>\n`;
      svg += `  </g>\n`;
      svg += `</g>\n`;
    }
    
    // SVGを閉じる
    svg += `</svg>`;
    
    return svg;
  }
  
  /**
   * 標準的なレイヤー構造のSVGを作成します（非イラストレーター互換）
   * @param {Array} layers - レイヤー情報の配列
   * @param {number} width - SVG幅
   * @param {number} height - SVG高さ
   * @returns {string} SVG文字列
   */
  function createLayeredSVG(layers, width, height) {
    // SVG基本構造
    let svg = `<svg xmlns="${SVG_NAMESPACE}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
    
    // レイヤーを追加
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      const visibility = layer.visible ? 'visible' : 'hidden';
      
      // レイヤーグループ
      svg += `<g id="${layer.id}" data-name="${layer.name}" display="${visibility}">\n`;
      
      // パスを追加
      if (layer.content) {
        // 直接パスが提供されている場合はそれを使用
        svg += `  ${layer.content.replace(/fill="[^"]*"/, `fill="${layer.color}"`)}\n`;
      } else {
        // ダミーパスを追加
        svg += `  <path fill="${layer.color}" d="M0,0 L0,0 Z"/>\n`;
      }
      
      svg += `</g>\n`;
    }
    
    // SVGを閉じる
    svg += `</svg>`;
    
    return svg;
  }
  
  /**
   * レイヤーの表示/非表示を設定します
   * @param {string} svgData - SVGデータ文字列
   * @param {string} layerId - レイヤーID
   * @param {boolean} visible - 表示状態
   * @returns {string} 更新されたSVGデータ
   */
  function setLayerVisibility(svgData, layerId, visible) {
    // 表示属性の値
    const displayValue = visible ? 'visible' : 'hidden';
    
    // イラストレーター互換のレイヤー構造の場合
    if (svgData.includes('i:layer="yes"')) {
      // 正規表現でレイヤーのdisplay属性を更新
      const regex = new RegExp(`(<g[^>]*id="${layerId}"[^>]*)display="[^"]*"([^>]*>)`, 'g');
      return svgData.replace(regex, `$1display="${displayValue}"$2`);
    } else {
      // 標準レイヤー構造の場合
      const regex = new RegExp(`(<g[^>]*id="${layerId}"[^>]*)display="[^"]*"([^>]*>)`, 'g');
      return svgData.replace(regex, `$1display="${displayValue}"$2`);
    }
  }
  
  /**
   * レイヤーの色を更新します
   * @param {string} svgData - SVGデータ文字列
   * @param {string} layerId - レイヤーID
   * @param {string} color - 新しい色（16進数）
   * @returns {string} 更新されたSVGデータ
   */
  function updateLayerColor(svgData, layerId, color) {
    // レイヤー内の全てのパスの色を更新
    const layerStartRegex = new RegExp(`<g[^>]*id="${layerId}"[^>]*>([\\s\\S]*?)<\/g>`, 'g');
    
    return svgData.replace(layerStartRegex, function(match, layerContent) {
      // パス内のfill属性を更新
      const updatedContent = layerContent.replace(/fill="[^"]*"/g, `fill="${color}"`);
      
      // 更新されたレイヤーを返す
      return match.replace(layerContent, updatedContent);
    });
  }
  
  /**
   * SVGからレイヤー情報を抽出します
   * @param {string} svgData - SVGデータ文字列
   * @returns {Array} レイヤー情報の配列
   */
  function extractLayers(svgData) {
    const layers = [];
    
    // イラストレーター互換のレイヤー構造の場合
    if (svgData.includes('i:layer="yes"')) {
      // レイヤー情報を正規表現で抽出
      const regex = /<g\s+id="([^"]+)"\s+i:layer="yes"[^>]*(?:display="([^"]+)")?[^>]*>[\s\S]*?i:name="([^"]+)"[\s\S]*?fill="([^"]+)"[\s\S]*?<\/g>/g;
      
      let match;
      while ((match = regex.exec(svgData)) !== null) {
        const id = match[1];
        const visible = match[2] !== 'hidden';
        const name = match[3];
        const color = match[4];
        
        layers.push({
          id: id,
          name: name,
          color: color,
          visible: visible
        });
      }
    } else {
      // 標準的なレイヤー構造の場合
      const regex = /<g\s+id="([^"]+)"\s+data-name="([^"]+)"[^>]*(?:display="([^"]+)")?[^>]*>[\s\S]*?fill="([^"]+)"[\s\S]*?<\/g>/g;
      
      let match;
      while ((match = regex.exec(svgData)) !== null) {
        const id = match[1];
        const name = match[2];
        const visible = match[3] !== 'hidden';
        const color = match[4];
        
        layers.push({
          id: id,
          name: name,
          color: color,
          visible: visible
        });
      }
    }
    
    return layers;
  }
  
  /**
   * RGB値を16進数カラーコードに変換します
   * @param {number} r - 赤（0-255）
   * @param {number} g - 緑（0-255）
   * @param {number} b - 青（0-255）
   * @returns {string} 16進数カラーコード
   */
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
      const hex = Math.round(x).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  /**
   * 色がグレースケールかどうかを判定します
   * @param {Array} color - 色情報 [R, G, B]
   * @param {number} tolerance - 許容差
   * @returns {boolean} グレースケールならtrue
   */
  function isGrayscale(color, tolerance = 10) {
    const [r, g, b] = color;
    return Math.abs(r - g) <= tolerance && 
           Math.abs(g - b) <= tolerance && 
           Math.abs(r - b) <= tolerance;
  }
  
  /**
   * RGB値から色名を推定します
   * @param {Array} color - 色情報 [R, G, B]
   * @returns {string|null} 色名または null
   */
  function colorToName(color) {
    const [r, g, b] = color;
    
    // グレースケールの場合
    if (isGrayscale(color)) {
      const brightness = Math.round((r + g + b) / 3);
      if (brightness < 32) return '黒';
      if (brightness < 64) return '暗いグレー';
      if (brightness < 128) return 'グレー';
      if (brightness < 196) return '明るいグレー';
      if (brightness < 240) return '薄いグレー';
      return '白';
    }
    
    // 一般的な色の判定（単純な方法）
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const hue = getHue(r, g, b);
    const sat = max === 0 ? 0 : diff / max;
    const val = max / 255;
    
    // 彩度が低い場合
    if (sat < 0.2) {
      return null; // 特定の色名に分類しない
    }
    
    // 明度が非常に低い場合
    if (val < 0.2) {
      return '暗い色';
    }
    
    // 色相に基づく色名
    if (hue >= 345 || hue < 15) return '赤';
    if (hue >= 15 && hue < 45) return 'オレンジ';
    if (hue >= 45 && hue < 75) return '黄色';
    if (hue >= 75 && hue < 105) return '黄緑';
    if (hue >= 105 && hue < 135) return '緑';
    if (hue >= 135 && hue < 165) return '青緑';
    if (hue >= 165 && hue < 195) return 'シアン';
    if (hue >= 195 && hue < 225) return '水色';
    if (hue >= 225 && hue < 255) return '青';
    if (hue >= 255 && hue < 285) return '青紫';
    if (hue >= 285 && hue < 315) return '紫';
    if (hue >= 315 && hue < 345) return 'マゼンタ';
    
    return null;
  }
  
  /**
   * RGB値から色相を計算します
   * @param {number} r - 赤（0-255）
   * @param {number} g - 緑（0-255）
   * @param {number} b - 青（0-255）
   * @returns {number} 色相（0-359）
   */
  function getHue(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    let h;
    
    if (max === min) {
      h = 0; // グレースケール
    } else if (max === r) {
      h = 60 * (0 + (g - b) / (max - min));
    } else if (max === g) {
      h = 60 * (2 + (b - r) / (max - min));
    } else {
      h = 60 * (4 + (r - g) / (max - min));
    }
    
    if (h < 0) h += 360;
    
    return h;
  }
  
  // 公開API
  return {
    createLayers: createLayers,
    getLayerName: getLayerName,
    createAICompatSVG: createAICompatSVG,
    createLayeredSVG: createLayeredSVG,
    setLayerVisibility: setLayerVisibility,
    updateLayerColor: updateLayerColor,
    extractLayers: extractLayers,
    rgbToHex: rgbToHex,
    isGrayscale: isGrayscale,
    colorToName: colorToName
  };
})(); 