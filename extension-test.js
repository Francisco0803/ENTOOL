// 扩展集成测试脚本
// 注意：此脚本需要在扩展的背景页面或开发者工具控制台中运行

// 测试翻译功能
async function testExtensionTranslation() {
  console.log("===== 开始扩展翻译功能测试 =====");
  
  // 测试用例
  const testCases = [
    "Hello world",
    "Machine learning is fascinating",
    "The quick brown fox jumps over the lazy dog",
    "人工智能正在改变世界",
    "云计算提供了可扩展的资源",
    "こんにちは、世界"
  ];
  
  // 依次测试每个案例
  for (let i = 0; i < testCases.length; i++) {
    const text = testCases[i];
    console.log(`\n== 测试案例 ${i + 1}: "${text}" ==`);
    
    try {
      // 模拟向内容脚本发送翻译请求
      await testTranslateRequest(text);
      // 每次测试之间等待一段时间，避免API限制
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`测试案例 ${i + 1} 失败:`, error);
    }
  }
  
  console.log("\n===== 扩展翻译功能测试完成 =====");
}

// 模拟向内容脚本发送翻译请求
async function testTranslateRequest(text) {
  return new Promise((resolve, reject) => {
    console.log(`发送翻译请求: "${text}"`);
    
    // 获取当前激活标签页
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (!tabs || tabs.length === 0) {
        const error = new Error("没有找到活动标签页");
        console.error(error);
        reject(error);
        return;
      }
      
      const activeTab = tabs[0];
      
      // 向标签页的内容脚本发送翻译请求
      chrome.tabs.sendMessage(
        activeTab.id,
        { action: "translate", text: text },
        response => {
          // 检查通信错误
          if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            console.error("发送翻译请求错误:", error.message);
            reject(error);
            return;
          }
          
          // 请求发送成功
          console.log("翻译请求已发送:", response);
          resolve(response);
          
          // 注意：实际的翻译结果会由内容脚本处理并显示在页面上
          // 此处仅测试消息通信是否正常
        }
      );
    });
  });
}

// 将API强制设置为Google翻译
function forceUseGoogleTranslate() {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ 'translationAPI': 'google' }, () => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError;
        console.error("设置默认翻译API失败:", error.message);
        reject(error);
        return;
      }
      
      console.log("默认翻译API已设置为Google翻译");
      resolve();
    });
  });
}

// 运行测试
async function runExtensionTests() {
  try {
    console.log("准备运行扩展测试...");
    
    // 首先将API设置为Google翻译
    await forceUseGoogleTranslate();
    
    // 然后运行翻译测试
    await testExtensionTranslation();
    
    console.log("所有测试完成");
  } catch (error) {
    console.error("测试过程中发生错误:", error);
  }
}

// 提示如何使用
console.log("扩展测试脚本已加载。运行 runExtensionTests() 开始测试。");
console.log("注意: 此脚本需要在已安装扩展的浏览器中运行，且需要有一个活动的标签页。");
console.log("您也可以单独运行 forceUseGoogleTranslate() 来强制使用Google翻译。"); 