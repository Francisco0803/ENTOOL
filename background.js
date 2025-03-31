// 安装扩展时创建上下文菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translateSelection",
    title: "雨神无敌翻译",
    contexts: ["selection"]
  });
});

// 有道API密钥（预配置）
let youdaoAppKey = '1335e8b48d7ec6a9';
let youdaoAppSecret = 'kWvJTMszgiv35O6Z0zYWysDZoiVrH9Wg';

// 从存储中加载设置
chrome.storage.sync.get(['translationAPI', 'youdaoAppKey', 'youdaoAppSecret'], function(result) {
  if (chrome.runtime.lastError) {
    console.error('存储读取错误:', chrome.runtime.lastError);
    return;
  }
  
  if (result.youdaoAppKey) {
    youdaoAppKey = result.youdaoAppKey;
  }
  if (result.youdaoAppSecret) {
    youdaoAppSecret = result.youdaoAppSecret;
  }
});

// 处理上下文菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelection") {
    // 检查页面是否能接收消息（确认内容脚本已加载）
    chrome.tabs.sendMessage(
      tab.id, 
      { action: "ping" }, 
      response => {
        if (chrome.runtime.lastError) {
          console.error('内容脚本未响应，尝试注入脚本:', chrome.runtime.lastError.message);
          
          // 如果内容脚本未加载，通知用户刷新页面
          try {
            // 尝试向用户显示通知，建议刷新页面
            chrome.tabs.sendMessage(tab.id, {
              action: "showNotification",
              message: "翻译扩展需要刷新页面才能正常工作。请刷新页面后再试。"
            });
          } catch (error) {
            console.error('无法显示通知:', error);
          }
          
          return;
        }
        
        // 内容脚本可用，发送翻译请求
        chrome.tabs.sendMessage(tab.id, {
          action: "translate",
          text: info.selectionText
        }, response => {
          // 检查通信错误
          if (chrome.runtime.lastError) {
            console.error('发送翻译请求错误:', chrome.runtime.lastError.message);
            return;
          }
          
          // 成功处理响应
          if (response && response.success) {
            console.log('翻译请求已发送到内容脚本');
          }
        });
      }
    );
  }
});

// 监听来自content.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === "youdaoTranslate") {
      // 执行有道翻译API请求（不受CORS限制）
      callYoudaoAPI(message.text)
        .then(data => {
          sendResponse({success: true, data: data});
        })
        .catch(error => {
          sendResponse({success: false, error: error.message});
        });
      
      // 返回true以保持消息通道开放，支持异步响应
      return true;
    }
    else if (message.action === "updateAPIKeys") {
      // 更新存储的API密钥
      youdaoAppKey = message.youdaoAppKey || youdaoAppKey;
      youdaoAppSecret = message.youdaoAppSecret || youdaoAppSecret;
      sendResponse({success: true});
    }
  } catch (error) {
    console.error('处理消息时出错:', error);
    sendResponse({success: false, error: error.message});
  }
  
  // 返回true以保持消息通道开放，支持异步响应
  return true;
});

// 辅助函数：确保字符串正确编码为UTF-8
function ensureUTF8Encoding(text) {
  // 使用TextEncoder确保UTF-8编码一致性
  try {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    console.log('UTF-8编码字节数:', bytes.length);
    return text;
  } catch (error) {
    console.error('UTF-8编码处理失败:', error);
    return text; // 失败时返回原始文本
  }
}

// 计算有道API签名的专用函数
function calculateYoudaoSignStrict(text, salt, curtime) {
  try {
    console.log('准备计算签名，原始文本:', text);
    
    // 确保UTF-8编码
    const encodedText = ensureUTF8Encoding(text);
    
    // 字节长度计算
    const encoder = new TextEncoder();
    const bytes = encoder.encode(encodedText);
    const textByteLength = bytes.length;
    console.log('文本UTF-8字节数:', textByteLength);
    
    // 按照有道的规则处理输入
    let input;
    if (encodedText.length > 20) {
      // 当文本长度大于20时，使用特殊处理
      const first10 = encodedText.substring(0, 10);
      const last10 = encodedText.substring(encodedText.length - 10);
      input = first10 + encodedText.length + last10; // 使用字符数量，不是字节数
      
      console.log('签名计算使用的处理后文本 (>20字符):', input);
      console.log('- 前10个字符:', first10);
      console.log('- 文本长度:', encodedText.length);
      console.log('- 后10个字符:', last10);
    } else {
      input = encodedText;
      console.log('签名计算使用的文本 (<=20字符):', input);
    }
    
    // 拼接签名字符串并计算MD5
    const signStr = youdaoAppKey + input + salt + curtime + youdaoAppSecret;
    console.log('签名字符串拼接:', signStr);
    const sign = md5(signStr);
    console.log('计算的MD5签名:', sign);
    
    return {
      sign: sign,
      input: input,
      signStr: signStr
    };
  } catch (error) {
    console.error('严格签名计算错误:', error);
    // 失败时尝试简单计算法
    const signStr = youdaoAppKey + text + salt + curtime + youdaoAppSecret;
    const sign = md5(signStr);
    return {
      sign: sign,
      input: text,
      signStr: signStr,
      error: error.message
    };
  }
}

// 计算有道API签名（标准版，供内部调用）
function calculateYoudaoSign(text, salt, curtime) {
  // 使用严格版计算签名，并返回签名结果
  const result = calculateYoudaoSignStrict(text, salt, curtime);
  return result.sign;
}

// 调用有道翻译API
async function callYoudaoAPI(text) {
  try {
    console.log('翻译文本字符数:', text.length);
    
    // 按照有道API文档要求准备参数
    const salt = String(Math.floor(Math.random() * 10000)); // 随机数
    const curtime = String(Math.floor(new Date().getTime() / 1000)); // 当前时间戳(秒)
    
    // 使用严格签名计算方法
    const signResult = calculateYoudaoSignStrict(text, salt, curtime);
    console.log('签名计算结果:', signResult);
    
    // 构建请求数据
    const params = new URLSearchParams();
    params.append('q', text);               // 待翻译文本
    params.append('from', 'auto');          // 源语言
    params.append('to', 'zh-CHS');          // 目标语言
    params.append('appKey', youdaoAppKey);  // 应用ID
    params.append('salt', salt);            // 随机字符串
    params.append('sign', signResult.sign); // 签名
    params.append('signType', 'v3');        // 签名类型
    params.append('curtime', curtime);      // 当前UTC时间戳(秒)
    
    // 记录请求参数供调试
    console.log('有道API请求参数:', {
      q: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
      appKey: youdaoAppKey,
      salt: salt,
      curtime: curtime,
      sign: signResult.sign,
      signType: 'v3',
      from: 'auto',
      to: 'zh-CHS'
    });
    
    // 发送请求
    const apiUrl = 'https://openapi.youdao.com/api';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params
    });
    
    console.log('有道API响应状态(background):', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP错误! 状态码: ${response.status}, 状态文本: ${response.statusText}`);
    }
    
    // 解析响应
    const data = await response.json();
    console.log('有道API返回数据(background):', data);
    
    // 处理响应
    if (data && data.translation && data.translation.length > 0) {
      // 翻译成功
      return data;
    } else if (data.errorCode && data.errorCode !== '0') {
      // 有错误码的情况
      const errorCode = data.errorCode;
      const errorMsg = getYoudaoErrorMessage(errorCode) || '未知错误';
      console.error(`有道翻译出错: 错误代码=${errorCode}, 错误描述=${errorMsg}`);
      
      // 如果是签名验证失败，输出更多调试信息
      if (errorCode === '202') {
        console.error('签名验证失败调试信息:');
        console.error('1. 原始文本:', text);
        console.error('2. 处理后用于签名的input:', signResult.input);
        console.error('3. 签名字符串:', signResult.signStr);
        console.error('4. 计算的签名:', signResult.sign);
        console.error('5. 应用ID:', youdaoAppKey);
        console.error('6. 应用密钥:', youdaoAppSecret.substring(0, 4) + '***');
        
        // 尝试使用备用方法重新计算
        console.log('尝试备用签名计算...');
        // 简单直接的方法
        const simpleSign = md5(youdaoAppKey + text + salt + curtime + youdaoAppSecret);
        console.log('备用简单签名:', simpleSign);
        
        // 采用字节长度而非字符长度
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        let specialInput;
        if (bytes.length > 20) {
          const first10 = text.substring(0, 10);
          const last10 = text.substring(text.length - 10);
          specialInput = first10 + bytes.length + last10;
        } else {
          specialInput = text;
        }
        const specialSignStr = youdaoAppKey + specialInput + salt + curtime + youdaoAppSecret;
        const specialSign = md5(specialSignStr);
        console.log('备用特殊签名:', specialSign);
        console.log('- 使用的input:', specialInput);
        
        // 如果尝试所有签名方法都失败，可能是API密钥问题
        throw new Error(`错误代码: ${errorCode}, ${errorMsg} - 有道API签名验证持续失败，请检查API密钥或考虑使用谷歌翻译`);
      }
      
      throw new Error(`错误代码: ${errorCode}, ${errorMsg}`);
    } else {
      // 其他异常情况
      throw new Error('翻译结果格式异常');
    }
  } catch (error) {
    console.error('有道翻译请求失败(background):', error);
    throw error;
  }
}

// 备用签名生成方法
function generateAlternativeSign(text, salt, curtime) {
  try {
    // 使用直接连接的方式，不做任何处理
    const input = text;
    const signStr = youdaoAppKey + input + salt + curtime + youdaoAppSecret;
    return md5(signStr);
  } catch (error) {
    console.error('备用签名生成失败:', error);
    return null;
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

// MD5算法实现（用于有道API签名）
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