// 弹出页面加载时执行
document.addEventListener('DOMContentLoaded', function() {
  // 获取页面元素
  const googleApiRadio = document.getElementById('google-api');
  const youdaoApiRadio = document.getElementById('youdao-api');
  const youdaoSettings = document.getElementById('youdao-settings');
  const appKeyInput = document.getElementById('app-key');
  const appSecretInput = document.getElementById('app-secret');
  const saveButton = document.getElementById('save-settings');
  const saveStatus = document.getElementById('save-status');
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // 默认显示有道设置区域
  youdaoSettings.classList.add('active');
  
  // 加载保存的设置
  chrome.storage.sync.get(['translationAPI', 'youdaoAppKey', 'youdaoAppSecret'], function(result) {
    if (chrome.runtime.lastError) {
      console.error('加载设置时出错:', chrome.runtime.lastError);
      return;
    }
    
    if (result.translationAPI === 'google') {
      googleApiRadio.checked = true;
      youdaoApiRadio.checked = false;
      youdaoSettings.classList.remove('active');
    } else {
      // 默认或已保存为有道
      youdaoApiRadio.checked = true;
      googleApiRadio.checked = false;
      youdaoSettings.classList.add('active');
    }
    
    if (result.youdaoAppKey) {
      appKeyInput.value = result.youdaoAppKey;
    }
    
    if (result.youdaoAppSecret) {
      appSecretInput.value = result.youdaoAppSecret;
    }
  });
  
  // 当API选择改变时显示/隐藏有道设置
  googleApiRadio.addEventListener('change', function() {
    if (this.checked) {
      youdaoSettings.classList.remove('active');
    }
  });
  
  youdaoApiRadio.addEventListener('change', function() {
    if (this.checked) {
      youdaoSettings.classList.add('active');
    }
  });
  
  // 保存设置
  saveButton.addEventListener('click', function() {
    const apiType = googleApiRadio.checked ? 'google' : 'youdao';
    const appKey = appKeyInput.value.trim();
    const appSecret = appSecretInput.value.trim();
    
    // 如果选择有道API但未填写密钥，显示警告
    if (apiType === 'youdao' && (!appKey || !appSecret)) {
      alert('请填写有道API的应用ID和密钥');
      return;
    }
    
    // 保存设置到Chrome存储
    chrome.storage.sync.set({
      translationAPI: apiType,
      youdaoAppKey: appKey,
      youdaoAppSecret: appSecret
    }, function() {
      if (chrome.runtime.lastError) {
        console.error('保存设置时出错:', chrome.runtime.lastError);
        alert('保存设置失败，请重试');
        return;
      }
      
      // 向background.js更新API密钥
      try {
        chrome.runtime.sendMessage({
          action: "updateAPIKeys",
          youdaoAppKey: appKey,
          youdaoAppSecret: appSecret
        }, function(response) {
          if (chrome.runtime.lastError) {
            console.error('向background发送密钥更新时出错:', chrome.runtime.lastError);
            // 错误不影响功能，因为background.js会在重新加载时从storage读取
          }
        });
      } catch (error) {
        console.error('更新背景脚本API密钥时出错:', error);
      }
      
      // 显示保存成功提示
      saveStatus.style.display = 'block';
      setTimeout(function() {
        saveStatus.style.display = 'none';
      }, 3000);
      
      // 向当前活动标签页发送更新设置的消息
      try {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (chrome.runtime.lastError) {
            console.error('查询标签页时出错:', chrome.runtime.lastError);
            return;
          }
          
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: "updateSettings",
              translationAPI: apiType,
              youdaoAppKey: appKey,
              youdaoAppSecret: appSecret
            }, function(response) {
              // 检查通信错误
              if (chrome.runtime.lastError) {
                console.error('发送设置更新消息时出错:', chrome.runtime.lastError.message);
                
                // 如果是接收端不存在的错误，提醒用户刷新页面
                if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
                  let errorMsg = document.createElement('div');
                  errorMsg.innerHTML = `
                    <div style="color: #e53935; margin-top: 5px; font-size: 12px;">
                      设置已保存，但无法同步到当前页面。<br>请刷新网页以应用新设置。
                    </div>
                  `;
                  saveStatus.parentNode.insertBefore(errorMsg, saveStatus.nextSibling);
                  
                  setTimeout(function() {
                    errorMsg.remove();
                  }, 5000);
                }
                return;
              }
              
              // 成功处理响应
              if (response && response.success) {
                console.log('设置已更新到内容脚本');
              }
            });
          }
        });
      } catch (error) {
        console.error('发送设置更新消息时发生异常:', error);
      }
    });
  });
  
  // 标签页切换功能
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // 移除所有标签页的active类
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // 添加当前标签页的active类
      tab.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}); 