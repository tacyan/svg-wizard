/**
 * @module ImageTracerUI
 * @description SVG Wizardのユーザーインターフェース機能を提供するモジュール
 * @version 3.5.0
 * @license MIT
 * 
 * このモジュールは、SVGプレビュー、レイヤー管理UI、進捗表示などの
 * ユーザーインターフェースに関連する機能を提供します。
 */

// グローバル名前空間にImageTracerUIを定義
window.ImageTracerUI = (function() {
  'use strict';
  
  /**
   * レイヤーリストUIを更新します
   * @param {Array} layers - レイヤー情報の配列
   * @param {HTMLElement} layersContainer - レイヤーコンテナ要素
   * @param {HTMLElement} layersList - レイヤーリスト要素
   * @param {Function} onVisibilityChange - 可視性変更コールバック関数(layerId, visible)
   * @param {Function} onColorChange - 色変更コールバック関数(layerId, color)
   */
  function updateLayersList(layers, layersContainer, layersList, onVisibilityChange, onColorChange) {
    if (!layers || layers.length === 0) {
      layersContainer.style.display = 'none';
      return;
    }
    
    // レイヤーコンテナを表示
    layersContainer.style.display = 'block';
    
    // レイヤーリストをクリア
    layersList.innerHTML = '';
    
    // レイヤーごとにリスト項目を作成
    layers.forEach(layer => {
      const layerItem = document.createElement('div');
      layerItem.className = 'layer-item';
      layerItem.setAttribute('data-layer-id', layer.id);
      
      // 可視性チェックボックス
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = layer.visible;
      checkbox.className = 'layer-visibility';
      checkbox.setAttribute('data-layer-id', layer.id);
      checkbox.addEventListener('change', function() {
        if (typeof onVisibilityChange === 'function') {
          onVisibilityChange(layer.id, this.checked);
        }
      });
      
      // レイヤー名
      const layerName = document.createElement('span');
      layerName.className = 'layer-name';
      layerName.textContent = layer.name;
      
      // カラーピッカー
      const colorPicker = document.createElement('input');
      colorPicker.type = 'color';
      colorPicker.className = 'layer-color';
      colorPicker.value = layer.color;
      colorPicker.setAttribute('data-layer-id', layer.id);
      colorPicker.addEventListener('change', function() {
        if (typeof onColorChange === 'function') {
          onColorChange(layer.id, this.value);
        }
      });
      
      // 要素を追加
      layerItem.appendChild(checkbox);
      layerItem.appendChild(layerName);
      layerItem.appendChild(colorPicker);
      
      // リストに追加
      layersList.appendChild(layerItem);
    });
  }
  
  /**
   * SVGコード表示を更新します
   * @param {string} svgData - SVGデータ文字列
   * @param {HTMLElement} codeElement - SVGコードを表示する要素
   */
  function updateSvgCodeDisplay(svgData, codeElement) {
    if (!svgData || !codeElement) return;
    
    // SVGデータが長すぎる場合は切り詰める
    const maxLength = 50000;
    let displayData = svgData;
    
    if (svgData.length > maxLength) {
      displayData = svgData.substring(0, maxLength) + 
        '\n\n/* SVGデータが長すぎるため省略されました（全' + 
        svgData.length + '文字中' + maxLength + '文字を表示） */';
    }
    
    // コード要素に設定
    codeElement.textContent = displayData;
  }
  
  /**
   * 進捗表示を更新します
   * @param {HTMLElement} progressBar - 進捗バー要素
   * @param {HTMLElement} progressText - 進捗テキスト要素
   * @param {string} stage - 現在の処理段階
   * @param {number} percent - 進捗率（0-100）
   */
  function updateProgress(progressBar, progressText, stage, percent) {
    if (!progressBar || !progressText) return;
    
    // 進捗バーを更新
    progressBar.style.width = percent + '%';
    
    // 進捗テキストを更新
    progressText.textContent = `${stage} ${Math.round(percent)}%`;
  }
  
  /**
   * エラーメッセージを表示します
   * @param {string} message - エラーメッセージ
   * @param {boolean} alert - アラートを表示するかどうか
   */
  function showError(message, alert) {
    console.error('[SVG Wizard エラー]', message);
    
    if (alert) {
      window.alert('エラー: ' + message);
    }
  }
  
  /**
   * 設定表示を更新します
   * @param {Object} formElements - フォーム要素のオブジェクト
   * @param {Object} settings - 設定オブジェクト
   */
  function updateSettings(formElements, settings) {
    if (!formElements || !settings) return;
    
    // カラーモード
    if (formElements.colorMode) {
      formElements.colorMode.value = settings.colorMode;
      
      // 関連項目の表示/非表示を更新
      const isBW = settings.colorMode === 'bw';
      if (document.querySelector('.threshold-container')) {
        document.querySelector('.threshold-container').style.display = isBW ? 'block' : 'none';
      }
      if (document.querySelector('.stroke-width-container')) {
        document.querySelector('.stroke-width-container').style.display = isBW ? 'block' : 'none';
      }
      if (document.querySelector('.color-quantization-container')) {
        document.querySelector('.color-quantization-container').style.display = isBW ? 'none' : 'block';
      }
    }
    
    // 閾値
    if (formElements.thresholdRange && formElements.thresholdValue) {
      formElements.thresholdRange.value = settings.threshold;
      formElements.thresholdValue.textContent = settings.threshold;
    }
    
    // 単純化
    if (formElements.simplifyRange && formElements.simplifyValue) {
      formElements.simplifyRange.value = settings.simplify;
      formElements.simplifyValue.textContent = settings.simplify;
    }
    
    // 色の数
    if (formElements.colorQuantizationRange && formElements.colorQuantizationValue) {
      formElements.colorQuantizationRange.value = settings.colorQuantization;
      formElements.colorQuantizationValue.textContent = settings.colorQuantization;
    }
    
    // ぼかし
    if (formElements.blurRadiusRange && formElements.blurRadiusValue) {
      formElements.blurRadiusRange.value = settings.blurRadius;
      formElements.blurRadiusValue.textContent = settings.blurRadius;
    }
    
    // ストローク幅
    if (formElements.strokeWidthRange && formElements.strokeWidthValue) {
      formElements.strokeWidthRange.value = settings.strokeWidth;
      formElements.strokeWidthValue.textContent = settings.strokeWidth;
    }
    
    // レイヤー有効
    if (formElements.enableLayers) {
      formElements.enableLayers.checked = settings.enableLayers;
      
      // 関連項目の表示/非表示を更新
      if (document.querySelector('.layer-options-container')) {
        document.querySelector('.layer-options-container').style.display = 
          settings.enableLayers ? 'block' : 'none';
      }
      if (document.querySelector('.illustrator-compat-container')) {
        document.querySelector('.illustrator-compat-container').style.display = 
          settings.enableLayers ? 'block' : 'none';
      }
    }
    
    // レイヤー命名
    if (formElements.layerNaming) {
      formElements.layerNaming.value = settings.layerNaming;
    }
    
    // イラストレーター互換
    if (formElements.illustratorCompat) {
      formElements.illustratorCompat.checked = settings.illustratorCompat;
    }
  }
  
  /**
   * SVGデータをダウンロードします
   * @param {string} svgData - SVGデータ文字列
   * @param {string} filename - ダウンロードするファイル名
   */
  function downloadSVG(svgData, filename) {
    if (!svgData) {
      showError('SVGデータがありません', true);
      return;
    }
    
    // ファイル名が指定されていない場合はデフォルト名を使用
    const downloadFilename = filename || 'svgwizard-export.svg';
    
    try {
      // SVG文字列を正しい形式に変換
      if (!svgData.startsWith('<?xml') && !svgData.startsWith('<svg')) {
        svgData = '<svg xmlns="http://www.w3.org/2000/svg">' + svgData + '</svg>';
      }
      
      // Blobを作成
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      
      // ダウンロードリンクを作成
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = downloadFilename;
      
      // リンクをクリック
      document.body.appendChild(link);
      link.click();
      
      // クリーンアップ
      setTimeout(function() {
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 100);
    } catch (error) {
      showError('SVGのダウンロード中にエラーが発生しました: ' + error.message, true);
    }
  }
  
  /**
   * 画像プレビューを表示します
   * @param {File} file - 画像ファイル
   * @param {HTMLImageElement} imageElement - 画像要素
   * @param {Function} callback - 読み込み完了時のコールバック関数
   */
  function displayImagePreview(file, imageElement, callback) {
    if (!file || !imageElement) return;
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
      imageElement.src = e.target.result;
      imageElement.alt = file.name;
      
      // 画像が読み込まれた後にコールバックを呼び出す
      if (typeof callback === 'function') {
        imageElement.onload = function() {
          callback(imageElement);
        };
      }
    };
    
    reader.onerror = function() {
      showError('画像の読み込みに失敗しました', true);
    };
    
    reader.readAsDataURL(file);
  }
  
  // 公開API
  return {
    updateLayersList: updateLayersList,
    updateSvgCodeDisplay: updateSvgCodeDisplay,
    updateProgress: updateProgress,
    showError: showError,
    updateSettings: updateSettings,
    downloadSVG: downloadSVG,
    displayImagePreview: displayImagePreview
  };
})(); 