// 在文件的最前面添加此代码，确保脚本及早初始化
console.log("翻译扩展内容脚本开始加载...");

// 立即执行函数，确保尽早初始化
(function() {
  // 标记内容脚本已经加载
  window.translationExtensionLoaded = true;
  
  // 检查DOM是否已经加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
  } else {
    // DOM已加载，立即初始化
    initializeExtension();
  }
  
  // 确保在页面完全加载后也能正确初始化
  window.addEventListener('load', function() {
    if (!window.translationExtensionInitialized) {
      console.log("页面加载完成后再次初始化扩展...");
      initializeExtension();
    }
  });
  
  function initializeExtension() {
    if (window.translationExtensionInitialized) {
      console.log("翻译扩展已经初始化，跳过重复初始化");
      return;
    }
    
    console.log("初始化翻译扩展...");
    
    try {
      // 创建翻译弹出框
      createTranslationPopup();
      
      // 初始化事件监听器
      initSelectionEvents();
      
      // 加载设置
      loadSettings();
      
      // 标记为已初始化
      window.translationExtensionInitialized = true;
      
      console.log("翻译扩展初始化完成");
    } catch (error) {
      console.error("初始化翻译扩展时出错:", error);
    }
  }
  
  // 创建翻译弹出框
  function createTranslationPopup() {
    // 如果已经存在则不重复创建
    if (document.getElementById('selection-translator-popup')) {
      console.log("翻译弹出框已存在，不重复创建");
      return;
    }
    
    console.log("创建翻译弹出框...");
    
    // 创建翻译弹出框
    let translationPopup = document.createElement('div');
    translationPopup.id = 'selection-translator-popup';
    translationPopup.style.cssText = `
      position: absolute;
      z-index: 99999;
      background: white;
      border: none;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      max-width: 350px;
      min-width: 250px;
      font-size: 14px;
      line-height: 1.5;
      color: #333;
      display: none;
      transition: opacity 0.2s, transform 0.2s;
      opacity: 0;
      transform: translateY(10px);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow: hidden;
    `;

    // 添加淡入效果的函数
    function fadeInPopup() {
      requestAnimationFrame(() => {
        translationPopup.style.opacity = '1';
        translationPopup.style.transform = 'translateY(0)';
      });
    }

    // 添加关闭按钮
    let closeButton = document.createElement('div');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      cursor: pointer;
      color: #999;
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 50%;
      transition: background-color 0.2s;
    `;
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.backgroundColor = '#f0f0f0';
      closeButton.style.color = '#666';
    });
    closeButton.addEventListener('mouseout', () => {
      closeButton.style.backgroundColor = 'transparent';
      closeButton.style.color = '#999';
    });
    closeButton.addEventListener('click', () => {
      translationPopup.style.display = 'none';
      lastTranslatedText = '';
      clearTranslationTimeout();
    });

    // 添加到弹出框
    translationPopup.appendChild(closeButton);

    // 创建内容容器 - 将翻译内容放在这个容器中
    let contentContainer = document.createElement('div');
    contentContainer.style.cssText = `
      margin-top: 5px;
      max-height: 350px;
      overflow-y: auto;
    `;
    translationPopup.appendChild(contentContainer);

    document.body.appendChild(translationPopup);

    // 存储上次翻译的文本，避免重复翻译
    let lastTranslatedText = '';
    // 默认翻译API
    let translationAPI = 'google';
    // 有道API密钥（预配置）
    let youdaoAppKey = '1335e8b48d7ec6a9';
    let youdaoAppSecret = 'kWvJTMszgiv35O6Z0zYWysDZoiVrH9Wg';
    // 超时计时器
    let translationTimeout = null;
    // 超时时间（毫秒）
    const TIMEOUT_DURATION = 10000; // 10秒
    // 通信错误标志，用于避免重复显示错误
    let communicationErrorShown = false;

    // 添加计数器跟踪有道API连续失败次数
    let youdaoConsecutiveFailures = 0;
    const MAX_YOUDAO_FAILURES = 3; // 最大连续失败次数

    // 加载设置
    function loadSettings() {
      try {
        chrome.storage.sync.get(['translationAPI', 'youdaoAppKey', 'youdaoAppSecret'], function(result) {
          if (chrome.runtime.lastError) {
            console.error('存储读取错误:', chrome.runtime.lastError);
            return;
          }
          
          if (result.translationAPI) {
            translationAPI = result.translationAPI;
          }
          if (result.youdaoAppKey) {
            youdaoAppKey = result.youdaoAppKey;
          }
          if (result.youdaoAppSecret) {
            youdaoAppSecret = result.youdaoAppSecret;
          }
          
          console.log("已加载设置，当前翻译API:", translationAPI);
        });
      } catch (error) {
        console.error('加载设置时出错:', error);
      }
    }

    // 监听鼠标选择事件和文本选择变化事件
    function initSelectionEvents() {
      console.log("初始化选择事件监听器...");
      
      // 鼠标选择事件 - 作为备选方案
      document.addEventListener('mouseup', handleTextSelection);
      
      // 键盘选择事件
      document.addEventListener('keyup', function(event) {
        // 当按下Shift, Ctrl, Alt并配合方向键或其他选择文本的键时触发
        if (event.shiftKey || event.ctrlKey || event.altKey) {
          setTimeout(handleTextSelection, 100);
        }
      });
      
      // 防抖定时器
      let selectionDebounceTimer = null;
      
      // 监听选择变化事件 - 实时翻译
      document.addEventListener('selectionchange', function() {
        // 清除之前的定时器
        clearTimeout(selectionDebounceTimer);
        clearTimeout(window.selectionChangeTimeout);
        
        // 设置防抖动延迟
        selectionDebounceTimer = setTimeout(function() {
          const selectedText = window.getSelection().toString().trim();
          
          // 只有当选择文本长度大于等于2时才触发翻译
          if (selectedText && selectedText.length >= 2) {
            console.log("检测到文本选择变化，立即翻译:", 
              selectedText.substring(0, 20) + (selectedText.length > 20 ? "..." : ""));
            
            // 直接调用处理函数进行翻译
            handleTextSelection(null);
          } else if (selectedText.length === 0 && translationPopup.style.display === 'block') {
            // 如果没有选中文本且弹窗正在显示，则隐藏弹窗
            translationPopup.style.display = 'none';
            lastTranslatedText = '';
            clearTranslationTimeout();
            communicationErrorShown = false;
          }
        }, 200); // 200毫秒的防抖延迟
      });
      
      // 点击页面其他地方隐藏弹出框
      document.addEventListener('click', function(event) {
        if (event.target !== translationPopup && !translationPopup.contains(event.target)) {
          translationPopup.style.display = 'none';
          // 清除可能存在的超时计时器
          clearTranslationTimeout();
          // 重置通信错误标志
          communicationErrorShown = false;
        }
      });
      
      console.log("选择事件监听器已初始化，实时翻译功能已启用");
    }

    // 处理文本选择
    function handleTextSelection(event) {
      // 获取选中的文本
      const selectedText = window.getSelection().toString().trim();
      console.log("检测到文本选择:", selectedText ? (selectedText.substring(0, 20) + (selectedText.length > 20 ? "..." : "")) : "无");
      
      // 如果没有选中文本，则隐藏弹出框
      if (!selectedText || selectedText.length === 0) {
        translationPopup.style.display = 'none';
        lastTranslatedText = '';
        clearTranslationTimeout();
        communicationErrorShown = false;
        return;
      }
      
      // 如果选中的文本太短，也不显示翻译
      if (selectedText.length < 2) {
        return;
      }
      
      // 防止重复翻译相同的文本
      if (selectedText === lastTranslatedText && translationPopup.style.display === 'block') {
        return;
      }
      
      lastTranslatedText = selectedText;
      
      // 显示加载提示
      contentContainer.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
          <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div style="margin-top: 10px; color: #666;">正在翻译中...</div>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      
      // 显示弹出框
      translationPopup.style.display = 'block';
      
      // 获取选中文本的位置
      let popupX, popupY;
      
      if (event) {
        // 如果是鼠标事件触发的
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        
        // 获取选中文本的位置信息
        const selectionRect = window.getSelection().getRangeAt(0).getBoundingClientRect();
        
        // 优先使用选中文本的位置，如果获取不到则使用鼠标位置
        popupX = selectionRect.width > 0 ? 
          (window.scrollX + selectionRect.left) : 
          (window.scrollX + mouseX);
        
        popupY = selectionRect.height > 0 ? 
          (window.scrollY + selectionRect.bottom + 10) : 
          (window.scrollY + mouseY + 20);
      } else {
        // 如果是其他方式触发的，尝试获取选择区域位置
        const selectionRect = window.getSelection().getRangeAt(0).getBoundingClientRect();
        
        if (selectionRect.width > 0) {
          popupX = window.scrollX + selectionRect.left;
          popupY = window.scrollY + selectionRect.bottom + 10;
        } else {
          // 如果无法获取位置，使用屏幕中央位置
          popupX = window.scrollX + window.innerWidth / 2 - 150; // 假设弹出框宽度约300px
          popupY = window.scrollY + window.innerHeight / 3;
        }
      }
      
      // 确保弹出框不会超出屏幕边界
      if (popupX < window.scrollX) {
        popupX = window.scrollX + 10;
      } else if (popupX + 350 > window.scrollX + window.innerWidth) {
        popupX = window.scrollX + window.innerWidth - 360;
      }
      
      if (popupY < window.scrollY) {
        popupY = window.scrollY + 10;
      } else if (popupY + 200 > window.scrollY + window.innerHeight) {
        popupY = window.scrollY + window.innerHeight - 210;
      }
      
      // 定位弹出框
      translationPopup.style.left = `${popupX}px`;
      translationPopup.style.top = `${popupY}px`;
      
      // 应用淡入效果
      fadeInPopup();
      
      // 设置超时
      setTranslationTimeout();
      
      // 自动触发翻译
      console.log("开始翻译文本:", selectedText.substring(0, 20) + (selectedText.length > 20 ? "..." : ""));
      translateText(selectedText);
    }

    // 安全地发送响应
    function safelySendResponse(sendResponse, data) {
      try {
        sendResponse(data);
      } catch (error) {
        console.error('发送响应时出错:', error);
        // 不需要进一步处理，因为这里只是尝试响应
      }
    }

    // 监听来自背景脚本的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      try {
        // 用于检查内容脚本是否已加载的ping消息
        if (message.action === "ping") {
          sendResponse({success: true, message: "content script is alive"});
          return true;
        }
        // 用于显示通知的消息
        else if (message.action === "showNotification") {
          // 创建一个临时通知元素
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #f44336;
            color: white;
            padding: 16px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            font-size: 14px;
            max-width: 80%;
            text-align: center;
          `;
          notification.textContent = message.message || "请刷新页面以使用翻译功能";
          document.body.appendChild(notification);
          
          // 5秒后自动消失
          setTimeout(() => {
            if (document.body.contains(notification)) {
              document.body.removeChild(notification);
            }
          }, 5000);
          
          sendResponse({success: true});
          return true;
        }
        // 翻译请求
        else if (message.action === "translate" && message.text) {
          // 显示加载提示
          contentContainer.innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
              <div style="display: inline-block; width: 24px; height: 24px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              <div style="margin-top: 10px; color: #666;">正在翻译中...</div>
            </div>
            <style>
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          `;
          
          translationPopup.style.display = 'block';
          
          // 定位弹出框到鼠标附近
          translationPopup.style.left = `${window.scrollX + 100}px`;
          translationPopup.style.top = `${window.scrollY + 100}px`;
          
          // 设置超时
          setTranslationTimeout();
          
          // 根据所选API翻译文本
          translateText(message.text);
          
          // 安全地发送响应
          safelySendResponse(sendResponse, {success: true});
        } else if (message.action === "updateSettings") {
          // 更新设置
          if (message.translationAPI) {
            translationAPI = message.translationAPI;
          }
          if (message.youdaoAppKey) {
            youdaoAppKey = message.youdaoAppKey;
          }
          if (message.youdaoAppSecret) {
            youdaoAppSecret = message.youdaoAppSecret;
          }
          
          // 安全地发送响应
          safelySendResponse(sendResponse, {success: true});
        } else {
          // 处理其他类型的消息
          safelySendResponse(sendResponse, {success: true});
        }
      } catch (error) {
        console.error('处理消息时出错:', error);
        if (!communicationErrorShown) {
          showCommunicationError();
          communicationErrorShown = true;
        }
        
        // 即使出错也尝试响应
        safelySendResponse(sendResponse, {success: false, error: error.message});
      }
      
      return true; // 保持消息通道开放，支持异步响应
    });

    // 显示通信错误
    function showCommunicationError() {
      contentContainer.innerHTML = `
        <div style="color: #e53935; font-weight: 600; margin-bottom: 8px;">扩展通信错误</div>
        <div style="color: #555; background: #fff8f8; padding: 8px; border-radius: 6px; font-size: 13px;">无法与扩展组件建立连接。这可能是因为：</div>
        <ul style="margin-top: 8px; padding-left: 25px; color: #666;">
          <li>扩展已重新加载或更新</li>
          <li>浏览器刚刚启动或刚从休眠状态恢复</li>
        </ul>
        <div style="font-size: 12px; margin-top: 12px;">
          <span style="font-weight: 500;">建议：</span>
          <ul style="margin-top: 5px; padding-left: 25px; color: #666;">
            <li>刷新当前页面</li>
            <li>重启浏览器</li>
            <li>检查扩展是否已启用</li>
          </ul>
        </div>
      `;
      
      // 应用淡入效果
      fadeInPopup();
    }

    // 设置翻译超时计时器
    function setTranslationTimeout() {
      // 先清除可能存在的旧计时器
      clearTranslationTimeout();
      
      // 设置新的超时计时器
      translationTimeout = setTimeout(() => {
        // 如果内容容器中包含"翻译中"字样，说明请求超时
        if (contentContainer.innerHTML.includes('正在翻译中') || 
            contentContainer.innerHTML.includes('正在连接谷歌翻译API') || 
            contentContainer.innerHTML.includes('正在连接有道翻译API')) {
          showTranslationError('翻译请求超时，可能是网络问题或API服务暂时不可用。');
        }
      }, TIMEOUT_DURATION);
    }

    // 清除翻译超时计时器
    function clearTranslationTimeout() {
      if (translationTimeout) {
        clearTimeout(translationTimeout);
        translationTimeout = null;
      }
    }

    // 显示翻译结果
    function showTranslation(originalText, translatedText, provider, isFallback = false) {
      // 清除超时计时器
      clearTranslationTimeout();
      
      // 构建翻译结果HTML
      let fallbackMessage = '';
      if (isFallback) {
        fallbackMessage = `
          <div style="font-size: 12px; color: #ff9800; margin-bottom: 12px; padding: 6px 10px; background-color: #fff8e1; border-radius: 4px;">
            由于默认翻译服务不可用，已自动切换到${provider}
          </div>
        `;
      }
      
      contentContainer.innerHTML = `
        ${fallbackMessage}
        <div style="margin-bottom: 12px;">
          <div style="font-size: 12px; color: #888; margin-bottom: 4px;">原文:</div>
          <div style="padding: 8px; background: #f5f5f5; border-radius: 4px; word-break: break-word;">${originalText}</div>
        </div>
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-size: 12px; color: #888;">翻译 (${provider}):</div>
            <div class="copy-button" style="cursor: pointer; font-size: 12px; color: #1a73e8; display: flex; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              复制
            </div>
          </div>
          <div class="translation-result" style="padding: 8px; background: #e3f2fd; border-radius: 4px; word-break: break-word;">${translatedText}</div>
        </div>
      `;
      
      // 添加复制功能
      const copyButton = contentContainer.querySelector('.copy-button');
      copyButton.addEventListener('click', function() {
        const textToCopy = translatedText;
        navigator.clipboard.writeText(textToCopy).then(function() {
          copyButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            已复制
          `;
          copyButton.style.color = '#4caf50';
          
          setTimeout(() => {
            copyButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              复制
            `;
            copyButton.style.color = '#1a73e8';
          }, 2000);
        }).catch(function(err) {
          console.error('复制文本失败:', err);
          copyButton.textContent = '复制失败';
          copyButton.style.color = '#e53935';
        });
      });
      
      // 应用淡入效果
      fadeInPopup();
    }

    // 显示翻译错误
    function showTranslationError(errorMessage) {
      // 清除超时计时器
      clearTranslationTimeout();
      
      contentContainer.innerHTML = `
        <div style="color: #e53935; font-weight: 600; margin-bottom: 10px;">翻译失败</div>
        <div style="color: #555; background: #fff8f8; padding: 12px; border-radius: 6px; font-size: 13px;">
          ${errorMessage}
        </div>
        <div style="font-size: 12px; margin-top: 12px; color: #666;">
          <div style="font-weight: 500; margin-bottom: 5px;">可能原因：</div>
          <ul style="margin-top: 5px; padding-left: 25px;">
            <li>网络连接问题</li>
            <li>翻译服务暂时不可用</li>
            <li>API密钥配置错误</li>
          </ul>
        </div>
        <div style="font-size: 12px; margin-top: 12px; color: #555;">
          <div style="font-weight: 500; margin-bottom: 5px;">建议：</div>
          <ul style="margin-top: 5px; padding-left: 25px;">
            <li>检查网络连接</li>
            <li>尝试切换翻译服务</li>
            <li>稍后重试</li>
          </ul>
        </div>
      `;
      
      // 应用淡入效果
      fadeInPopup();
    }

    // 翻译功能
    function translateText(text) {
      // 如果有道API连续失败次数超过阈值，自动切换到谷歌翻译
      if (youdaoConsecutiveFailures >= MAX_YOUDAO_FAILURES) {
        console.log(`有道API连续失败${youdaoConsecutiveFailures}次，自动切换到谷歌翻译`);
        translateWithGoogle(text);
        return;
      }
      
      // 根据设置选择翻译API
      if (translationAPI === 'youdao' && youdaoAppKey && youdaoAppSecret) {
        // 如果有道API已配置，优先使用有道API，并允许在出错时自动切换到谷歌翻译
        translateWithYoudao(text, true);
      } else {
        // 如果有道API未配置或选择了谷歌API
        translateWithGoogle(text);
      }
    }

    // 使用谷歌翻译API
    function translateWithGoogle(text, isFallback = false) {
      const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
      
      // 显示正在尝试连接的信息
      contentContainer.innerHTML = `
        <div style="padding: 10px 0;">
          <div style="margin-bottom: 12px; display: flex; align-items: center;">
            <div style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #4285f4; border-radius: 50%; animation: googleSpin 1s linear infinite; margin-right: 10px;"></div>
            <div>正在连接谷歌翻译API...</div>
          </div>
          <div style="font-size: 12px; color: #888; margin-top: 5px; word-break: break-all;">
            API地址: ${apiUrl.substring(0, 60)}...
          </div>
        </div>
        <style>
          @keyframes googleSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      
      // 应用淡入效果
      fadeInPopup();
      
      fetch(apiUrl)
        .then(response => {
          console.log('谷歌API响应状态:', response.status, response.statusText);
          
          if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}, 状态文本: ${response.statusText}`);
          }
          return response.json();
        })
        .then(data => {
          // 清除超时计时器，因为请求已成功
          clearTranslationTimeout();
          
          if (data && data[0] && data[0][0] && data[0][0][0]) {
            const translatedText = data[0].map(item => item[0]).join('');
            
            // 如果谷歌翻译成功且有道连续失败超过阈值，切换默认API
            if (youdaoConsecutiveFailures >= MAX_YOUDAO_FAILURES) {
              console.log(`由于有道API连续失败${youdaoConsecutiveFailures}次，设置默认API为谷歌翻译`);
              translationAPI = 'google';
              // 尝试保存设置
              try {
                chrome.storage.sync.set({ 'translationAPI': 'google' }, function() {
                  console.log('已将默认翻译API保存为谷歌翻译');
                });
              } catch (error) {
                console.error('保存设置失败:', error);
              }
            }
            
            showTranslation(text, translatedText, 'Google 翻译', isFallback);
          } else {
            throw new Error('返回的翻译数据格式无效');
          }
        })
        .catch(error => {
          // 清除超时计时器，因为已经捕获到错误
          clearTranslationTimeout();
          
          console.error('谷歌翻译出错:', error);
          showTranslationError(`谷歌翻译服务异常: ${error.message || '未知错误'}`);
        });
    }

    // 使用有道翻译API
    function translateWithYoudao(text, canFallbackToGoogle = false) {
      if (!youdaoAppKey || !youdaoAppSecret) {
        // 清除超时计时器
        clearTranslationTimeout();
        
        if (canFallbackToGoogle) {
          console.log('有道API未配置，回退到谷歌翻译');
          contentContainer.innerHTML = `
            <div style="color: #ff9800; padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 15px;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                <span style="font-weight: 500;">有道API未配置</span>
              </div>
              <div style="font-size: 13px;">正在切换到谷歌翻译...</div>
            </div>
          `;
          
          // 应用淡入效果
          fadeInPopup();
          
          setTimeout(() => translateWithGoogle(text, true), 1000);
          return;
        }
        
        contentContainer.innerHTML = `
          <div style="color: #e53935; font-weight: 600; margin-bottom: 8px;">API未配置</div>
          <div style="color: #555; background: #fff8f8; padding: 12px; border-radius: 6px; font-size: 13px;">
            请先在扩展设置中配置有道API密钥<br>
            点击扩展图标，在弹出窗口中设置API密钥
          </div>
        `;
        
        // 应用淡入效果
        fadeInPopup();
        
        return;
      }
      
      // 显示正在尝试连接的信息
      contentContainer.innerHTML = `
        <div style="padding: 10px 0;">
          <div style="margin-bottom: 12px; display: flex; align-items: center;">
            <div style="width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #e74c3c; border-radius: 50%; animation: youdaoSpin 1s linear infinite; margin-right: 10px;"></div>
            <div>正在连接有道翻译API...</div>
          </div>
          <div style="font-size: 12px; color: #888; margin-top: 8px;">
            API地址: https://openapi.youdao.com/api<br>
            应用ID: ${youdaoAppKey.substring(0, 5)}...
          </div>
        </div>
        <style>
          @keyframes youdaoSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;
      
      // 应用淡入效果
      fadeInPopup();
      
      try {
        // 通过background.js发送请求，避开CORS限制
        chrome.runtime.sendMessage(
          {
            action: "youdaoTranslate",
            text: text
          },
          response => {
            // 检查通信错误
            if (chrome.runtime.lastError) {
              console.error('向background发送消息时出错:', chrome.runtime.lastError);
              
              // 增加失败计数
              youdaoConsecutiveFailures++;
              console.log(`有道API失败计数: ${youdaoConsecutiveFailures}/${MAX_YOUDAO_FAILURES}`);
              
              // 如果出现通信错误，尝试使用谷歌翻译
              if (canFallbackToGoogle) {
                console.log('与background通信出错，回退到谷歌翻译');
                contentContainer.innerHTML = `
                  <div style="color: #ff9800; padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                      <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                      <span style="font-weight: 500;">与扩展后台通信失败</span>
                    </div>
                    <div style="font-size: 13px;">正在切换到谷歌翻译...</div>
                  </div>
                `;
                
                // 应用淡入效果
                fadeInPopup();
                
                setTimeout(() => translateWithGoogle(text, true), 1000);
              } else {
                // 显示通信错误
                clearTranslationTimeout();
                showTranslationError(`扩展通信错误: ${chrome.runtime.lastError.message || '未知错误'}`);
              }
              return;
            }
            
            // 清除超时计时器
            clearTranslationTimeout();
            
            // 处理响应
            if (response && response.success && response.data) {
              // 成功获取翻译结果
              const data = response.data;
              
              // 先验证数据结构是否符合预期
              if (data.translation && data.translation.length > 0) {
                // 翻译成功，重置失败计数
                youdaoConsecutiveFailures = 0;
                
                // 如果连续失败计数大于0但小于阈值，重置计数器
                if (youdaoConsecutiveFailures > 0) {
                  console.log('翻译成功，重置失败计数');
                  youdaoConsecutiveFailures = 0;
                }
                
                showTranslation(text, data.translation.join('\n'), '有道翻译');
              } else {
                console.error('有道API返回的数据缺少translation字段:', data);
                
                // 增加失败计数
                youdaoConsecutiveFailures++;
                console.log(`有道API失败计数: ${youdaoConsecutiveFailures}/${MAX_YOUDAO_FAILURES}`);
                
                // 检查是否有错误码
                if (data.errorCode && data.errorCode !== '0') {
                  const errorMsg = getYoudaoErrorMessage(data.errorCode) || '未知错误';
                  
                  // 签名错误的特殊处理
                  if (data.errorCode === '202') {
                    console.error('有道API签名验证失败 (202)');
                    
                    if (canFallbackToGoogle) {
                      contentContainer.innerHTML = `
                        <div style="color: #ff9800; padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 15px;">
                          <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                            <span style="font-weight: 500;">有道翻译签名验证失败</span>
                          </div>
                          <div style="font-size: 13px;">错误代码: 202 (${errorMsg})</div>
                        </div>
                      `;
                      
                      // 如果连续失败达到阈值，切换默认API
                      if (youdaoConsecutiveFailures >= MAX_YOUDAO_FAILURES) {
                        console.log(`连续签名失败${youdaoConsecutiveFailures}次，切换默认API为谷歌翻译`);
                        changeDefaultAPI('google');
                      }
                      
                      setTimeout(() => translateWithGoogle(text, true), 1500);
                    } else {
                      showTranslationError(`有道翻译签名验证失败: ${errorMsg} (错误代码: 202)`);
                    }
                  } else {
                    // 其他错误的处理
                    if (canFallbackToGoogle) {
                      contentContainer.innerHTML = `
                        <div style="color: #ff9800; padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 15px;">
                          <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                            <span style="font-weight: 500;">有道翻译API错误</span>
                          </div>
                          <div style="font-size: 13px;">错误代码: ${data.errorCode}</div>
                          <div style="font-size: 13px; margin-top: 8px;">正在切换到谷歌翻译服务...</div>
                        </div>
                      `;
                      
                      // 应用淡入效果
                      fadeInPopup();
                      
                      setTimeout(() => translateWithGoogle(text, true), 1500);
                    } else {
                      showTranslationError(`有道翻译服务错误: ${errorMsg} (错误代码: ${data.errorCode})`);
                    }
                  }
                } else {
                  // 无明确错误码但返回格式异常
                  if (canFallbackToGoogle) {
                    contentContainer.innerHTML = `
                      <div style="color: #ff9800; padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 15px;">
                        <div style="display: flex; align-items: center; margin-bottom: 8px;">
                          <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                          <span style="font-weight: 500;">有道翻译返回格式异常</span>
                        </div>
                        <div style="font-size: 13px;">正在切换到谷歌翻译服务...</div>
                      </div>
                    `;
                    
                    // 应用淡入效果
                    fadeInPopup();
                    
                    setTimeout(() => translateWithGoogle(text, true), 1500);
                  } else {
                    showTranslationError('有道翻译返回结果格式异常，未找到翻译内容');
                  }
                }
              }
            } else {
              // 处理错误
              const errorMessage = response && response.error ? response.error : '未知错误';
              console.error('有道翻译出错:', errorMessage);
              
              // 增加失败计数
              youdaoConsecutiveFailures++;
              console.log(`有道API失败计数: ${youdaoConsecutiveFailures}/${MAX_YOUDAO_FAILURES}`);
              
              // 常见错误的用户友好提示
              let userFriendlyError = errorMessage;
              if (errorMessage.includes('签名检验失败') || errorMessage.includes('202')) {
                userFriendlyError = '签名验证失败 (错误代码: 202)，可能由于编码问题或API密钥配置错误';
              } else if (errorMessage.includes('缺少必填参数')) {
                userFriendlyError = 'API调用缺少必填参数 (错误代码: 101)';
              }
              
              // 如果允许回退且错误是API或网络相关的，尝试使用谷歌翻译
              if (canFallbackToGoogle) {
                console.log('有道API请求失败，自动回退到谷歌翻译');
                contentContainer.innerHTML = `
                  <div style="color: #ff9800; padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 8px;">
                      <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                      <span style="font-weight: 500;">有道翻译API请求失败</span>
                    </div>
                    <div style="font-size: 13px;">${userFriendlyError}</div>
                    <div style="font-size: 13px; margin-top: 8px;">正在切换到谷歌翻译服务...</div>
                  </div>
                `;
                
                // 如果连续失败达到阈值，切换默认API
                if (youdaoConsecutiveFailures >= MAX_YOUDAO_FAILURES) {
                  console.log(`有道API连续失败${youdaoConsecutiveFailures}次，切换默认API为谷歌翻译`);
                  changeDefaultAPI('google');
                }
                
                setTimeout(() => translateWithGoogle(text, true), 1500);
              } else {
                // 显示错误信息
                showTranslationError(`有道翻译服务异常: ${userFriendlyError}`);
              }
            }
          }
        );
      } catch (error) {
        // 清除超时计时器
        clearTranslationTimeout();
        
        console.error('发送有道翻译请求时出错:', error);
        
        // 增加失败计数
        youdaoConsecutiveFailures++;
        console.log(`有道API失败计数: ${youdaoConsecutiveFailures}/${MAX_YOUDAO_FAILURES}`);
        
        // 如果允许回退，尝试使用谷歌翻译
        if (canFallbackToGoogle) {
          console.log('发送有道翻译请求时出错，回退到谷歌翻译');
          contentContainer.innerHTML = `
            <div style="color: #ff9800; padding: 12px; background: #fff8e1; border-radius: 6px; margin-bottom: 15px;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                <span style="font-weight: 500;">有道翻译请求出错</span>
              </div>
              <div style="font-size: 13px;">${error.message || '未知错误'}</div>
              <div style="font-size: 13px; margin-top: 8px;">正在切换到谷歌翻译服务...</div>
            </div>
          `;
          
          // 应用淡入效果
          fadeInPopup();
          
          // 如果连续失败达到阈值，切换默认API
          if (youdaoConsecutiveFailures >= MAX_YOUDAO_FAILURES) {
            console.log(`有道API连续失败${youdaoConsecutiveFailures}次，切换默认API为谷歌翻译`);
            changeDefaultAPI('google');
          }
          
          setTimeout(() => translateWithGoogle(text, true), 1500);
        } else {
          // 显示错误信息
          showTranslationError(`有道翻译请求出错: ${error.message || '未知错误'}`);
        }
      }
    }

    // 切换默认API并保存设置
    function changeDefaultAPI(newAPI) {
      translationAPI = newAPI;
      // 保存到存储
      try {
        chrome.storage.sync.set({ 'translationAPI': newAPI }, function() {
          console.log(`已将默认翻译API保存为: ${newAPI}`);
        });
      } catch (error) {
        console.error('保存API设置失败:', error);
      }
    }

    // 获取有道API错误码对应的错误信息
    function getYoudaoErrorMessage(errorCode) {
      const errorMap = {
        '101': '缺少必填参数',
        '102': '不支持的语言类型',
        '103': '翻译文本过长',
        '108': '应用ID无效',
        '110': '无效的签名',
        '111': '无效的公钥',
        '112': '请求频率受限',
        '113': 'QPS限制',
        '202': '签名检验失败',
        '401': '账户已经欠费',
        '411': '访问频率受限'
      };
      
      return errorMap[errorCode] || '未知错误';
    }

    // 计算有道API签名
    function calculateYoudaoSign(text, salt, curtime) {
      let input = text;
      // 有道API要求，当文本长度大于20时，计算前10+长度+后10位字符的哈希
      if (input.length > 20) {
        const len = input.length;
        // 确保取到前10个字符和后10个字符，中间是长度数字
        const first10 = input.substring(0, 10);
        const last10 = input.substring(input.length - 10);
        input = first10 + len + last10;
      }
      
      // 拼接字符串
      const signStr = youdaoAppKey + input + salt + curtime + youdaoAppSecret;
      
      // 计算md5
      return md5(signStr);
    }

    // 完整的MD5实现（用于有道API签名）
    function md5(string) {
      function rotateLeft(lValue, iShiftBits) {
        return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
      }

      function addUnsigned(lX, lY) {
        let lX4, lY4, lX8, lY8, lResult;
        lX8 = (lX & 0x80000000);
        lY8 = (lY & 0x80000000);
        lX4 = (lX & 0x40000000);
        lY4 = (lY & 0x40000000);
        lResult = (lX & 0x3FFFFFFF) + (lY & 0x3FFFFFFF);
        if (lX4 & lY4) {
          return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
        }
        if (lX4 | lY4) {
          if (lResult & 0x40000000) {
            return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
          } else {
            return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
          }
        } else {
          return (lResult ^ lX8 ^ lY8);
        }
      }

      function F(x, y, z) { return (x & y) | ((~x) & z); }
      function G(x, y, z) { return (x & z) | (y & (~z)); }
      function H(x, y, z) { return (x ^ y ^ z); }
      function I(x, y, z) { return (y ^ (x | (~z))); }

      function FF(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
      }

      function GG(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
      }

      function HH(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
      }

      function II(a, b, c, d, x, s, ac) {
        a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
        return addUnsigned(rotateLeft(a, s), b);
      }

      function convertToWordArray(string) {
        let lWordCount;
        const lMessageLength = string.length;
        const lNumberOfWords_temp1 = lMessageLength + 8;
        const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
        const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
        const lWordArray = Array(lNumberOfWords - 1);
        let lBytePosition = 0;
        let lByteCount = 0;
        while (lByteCount < lMessageLength) {
          lWordCount = (lByteCount - (lByteCount % 4)) / 4;
          lBytePosition = (lByteCount % 4) * 8;
          lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition));
          lByteCount++;
        }
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
        lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
        lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
        return lWordArray;
      }

      function wordToHex(lValue) {
        let wordToHexValue = "", wordToHexValue_temp = "", lByte, lCount;
        for (lCount = 0; lCount <= 3; lCount++) {
          lByte = (lValue >>> (lCount * 8)) & 255;
          wordToHexValue_temp = "0" + lByte.toString(16);
          wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
        }
        return wordToHexValue;
      }

      function utf8Encode(string) {
        string = string.replace(/\r\n/g, "\n");
        let utftext = "";

        for (let n = 0; n < string.length; n++) {
          let c = string.charCodeAt(n);

          if (c < 128) {
            utftext += String.fromCharCode(c);
          } else if ((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
          } else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
          }
        }

        return utftext;
      }

      let x = Array();
      let k, AA, BB, CC, DD, a, b, c, d;
      const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
      const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
      const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
      const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

      string = utf8Encode(string);
      x = convertToWordArray(string);
      a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

      for (k = 0; k < x.length; k += 16) {
        AA = a; BB = b; CC = c; DD = d;
        a = FF(a, b, c, d, x[k + 0], S11, 0xD76AA478);
        d = FF(d, a, b, c, x[k + 1], S12, 0xE8C7B756);
        c = FF(c, d, a, b, x[k + 2], S13, 0x242070DB);
        b = FF(b, c, d, a, x[k + 3], S14, 0xC1BDCEEE);
        a = FF(a, b, c, d, x[k + 4], S11, 0xF57C0FAF);
        d = FF(d, a, b, c, x[k + 5], S12, 0x4787C62A);
        c = FF(c, d, a, b, x[k + 6], S13, 0xA8304613);
        b = FF(b, c, d, a, x[k + 7], S14, 0xFD469501);
        a = FF(a, b, c, d, x[k + 8], S11, 0x698098D8);
        d = FF(d, a, b, c, x[k + 9], S12, 0x8B44F7AF);
        c = FF(c, d, a, b, x[k + 10], S13, 0xFFFF5BB1);
        b = FF(b, c, d, a, x[k + 11], S14, 0x895CD7BE);
        a = FF(a, b, c, d, x[k + 12], S11, 0x6B901122);
        d = FF(d, a, b, c, x[k + 13], S12, 0xFD987193);
        c = FF(c, d, a, b, x[k + 14], S13, 0xA679438E);
        b = FF(b, c, d, a, x[k + 15], S14, 0x49B40821);
        a = GG(a, b, c, d, x[k + 1], S21, 0xF61E2562);
        d = GG(d, a, b, c, x[k + 6], S22, 0xC040B340);
        c = GG(c, d, a, b, x[k + 11], S23, 0x265E5A51);
        b = GG(b, c, d, a, x[k + 0], S24, 0xE9B6C7AA);
        a = GG(a, b, c, d, x[k + 5], S21, 0xD62F105D);
        d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
        c = GG(c, d, a, b, x[k + 15], S23, 0xD8A1E681);
        b = GG(b, c, d, a, x[k + 4], S24, 0xE7D3FBC8);
        a = GG(a, b, c, d, x[k + 9], S21, 0x21E1CDE6);
        d = GG(d, a, b, c, x[k + 14], S22, 0xC33707D6);
        c = GG(c, d, a, b, x[k + 3], S23, 0xF4D50D87);
        b = GG(b, c, d, a, x[k + 8], S24, 0x455A14ED);
        a = GG(a, b, c, d, x[k + 13], S21, 0xA9E3E905);
        d = GG(d, a, b, c, x[k + 2], S22, 0xFCEFA3F8);
        c = GG(c, d, a, b, x[k + 7], S23, 0x676F02D9);
        b = GG(b, c, d, a, x[k + 12], S24, 0x8D2A4C8A);
        a = HH(a, b, c, d, x[k + 5], S31, 0xFFFA3942);
        d = HH(d, a, b, c, x[k + 8], S32, 0x8771F681);
        c = HH(c, d, a, b, x[k + 11], S33, 0x6D9D6122);
        b = HH(b, c, d, a, x[k + 14], S34, 0xFDE5380C);
        a = HH(a, b, c, d, x[k + 1], S31, 0xA4BEEA44);
        d = HH(d, a, b, c, x[k + 4], S32, 0x4BDECFA9);
        c = HH(c, d, a, b, x[k + 7], S33, 0xF6BB4B60);
        b = HH(b, c, d, a, x[k + 10], S34, 0xBEBFBC70);
        a = HH(a, b, c, d, x[k + 13], S31, 0x289B7EC6);
        d = HH(d, a, b, c, x[k + 0], S32, 0xEAA127FA);
        c = HH(c, d, a, b, x[k + 3], S33, 0xD4EF3085);
        b = HH(b, c, d, a, x[k + 6], S34, 0x4881D05);
        a = HH(a, b, c, d, x[k + 9], S31, 0xD9D4D039);
        d = HH(d, a, b, c, x[k + 12], S32, 0xE6DB99E5);
        c = HH(c, d, a, b, x[k + 15], S33, 0x1FA27CF8);
        b = HH(b, c, d, a, x[k + 2], S34, 0xC4AC5665);
        a = II(a, b, c, d, x[k + 0], S41, 0xF4292244);
        d = II(d, a, b, c, x[k + 7], S42, 0x432AFF97);
        c = II(c, d, a, b, x[k + 14], S43, 0xAB9423A7);
        b = II(b, c, d, a, x[k + 5], S44, 0xFC93A039);
        a = II(a, b, c, d, x[k + 12], S41, 0x655B59C3);
        d = II(d, a, b, c, x[k + 3], S42, 0x8F0CCC92);
        c = II(c, d, a, b, x[k + 10], S43, 0xFFEFF47D);
        b = II(b, c, d, a, x[k + 1], S44, 0x85845DD1);
        a = II(a, b, c, d, x[k + 8], S41, 0x6FA87E4F);
        d = II(d, a, b, c, x[k + 15], S42, 0xFE2CE6E0);
        c = II(c, d, a, b, x[k + 6], S43, 0xA3014314);
        b = II(b, c, d, a, x[k + 13], S44, 0x4E0811A1);
        a = II(a, b, c, d, x[k + 4], S41, 0xF7537E82);
        d = II(d, a, b, c, x[k + 11], S42, 0xBD3AF235);
        c = II(c, d, a, b, x[k + 2], S43, 0x2AD7D2BB);
        b = II(b, c, d, a, x[k + 9], S44, 0xEB86D391);
        a = addUnsigned(a, AA);
        b = addUnsigned(b, BB);
        c = addUnsigned(c, CC);
        d = addUnsigned(d, DD);
      }

      const result = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d);
      return result.toLowerCase();
    }
  }
})(); 