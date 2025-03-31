// 测试谷歌翻译API的功能
function testGoogleTranslate() {
  // 要翻译的文本样本
  const textSamples = [
    "Hello world",
    "Machine learning is fascinating",
    "The quick brown fox jumps over the lazy dog",
    "Artificial intelligence has made significant progress",
    "Cloud computing offers scalable resources on demand"
  ];
  
  // 中文文本测试
  const chineseTextSamples = [
    "人工智能正在改变世界",
    "云计算提供了可扩展的资源",
    "大数据分析帮助企业做出更好的决策",
    "区块链技术提供了不可篡改的记录机制"
  ];
  
  // 带特殊字符的文本测试
  const specialCharTextSamples = [
    "C'est la vie! ¿Cómo estás?",
    "München ist eine schöne Stadt",
    "こんにちは、世界",
    "안녕하세요 세계"
  ];
  
  console.log("===== 开始谷歌翻译API测试 =====");
  
  // 测试英文到中文的翻译
  console.log("\n== 英文到中文翻译测试 ==");
  textSamples.forEach((text, index) => {
    console.log(`\n测试案例 ${index + 1}: "${text}"`);
    testTranslateText(text);
  });
  
  // 测试中文到英文的翻译
  console.log("\n== 中文到英文翻译测试 ==");
  chineseTextSamples.forEach((text, index) => {
    console.log(`\n测试案例 ${index + 1}: "${text}"`);
    testTranslateText(text);
  });
  
  // 测试带特殊字符的文本
  console.log("\n== 特殊字符文本翻译测试 ==");
  specialCharTextSamples.forEach((text, index) => {
    console.log(`\n测试案例 ${index + 1}: "${text}"`);
    testTranslateText(text);
  });
}

// 测试翻译指定文本
function testTranslateText(text) {
  const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
  console.log(`请求URL: ${apiUrl}`);
  
  fetch(apiUrl)
    .then(response => {
      console.log(`响应状态: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态码: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translatedText = data[0].map(item => item[0]).join('');
        console.log(`翻译结果: "${translatedText}"`);
        return translatedText;
      } else {
        throw new Error('返回的翻译数据格式无效');
      }
    })
    .catch(error => {
      console.error(`翻译出错: ${error.message}`);
    });
}

// 如果在浏览器中运行，则自动启动测试
if (typeof window !== 'undefined') {
  console.log("脚本已加载，请在控制台中运行 testGoogleTranslate() 函数进行测试");
} 