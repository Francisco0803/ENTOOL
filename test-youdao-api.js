// 有道API测试脚本
const youdaoAppKey = '换上自己的API';
const youdaoAppSecret = '换上自己的API';

// 计算有道API签名
function calculateYoudaoSign(text, salt, curtime) {
  console.log('计算签名，原始文本:', text);
  
  let input = text;
  // 有道API要求，当文本长度大于20时，计算前10+长度+后10位字符的哈希
  if (input.length > 20) {
    const len = input.length;
    input = input.substring(0, 10) + len + input.substring(input.length - 10, input.length);
    console.log('处理后的文本 (>20字符):', input);
  } else {
    console.log('文本无需处理 (<=20字符)');
  }
  
  // 拼接字符串
  const signStr = youdaoAppKey + input + salt + curtime + youdaoAppSecret;
  console.log('签名字符串拼接:', signStr);
  
  // 计算md5
  const signHash = md5(signStr);
  console.log('最终MD5签名:', signHash);
  
  return signHash;
}

// 简化版MD5实现
function md5(string) {
  // 这里仅用于测试演示，实际使用时应当使用完整的MD5实现
  const crypto = require('crypto');
  return crypto.createHash('md5').update(string).digest('hex');
}

// 测试示例
const text = 'hello';
const salt = '1234';
const curtime = '1234567890';
const sign = calculateYoudaoSign(text, salt, curtime);

console.log('\n--- 测试结果 ---');
console.log('文本:', text);
console.log('Salt:', salt);
console.log('Curtime:', curtime);
console.log('签名:', sign);

// 构建请求URL
const params = new URLSearchParams();
params.append('q', text);
params.append('from', 'auto');
params.append('to', 'zh-CHS');
params.append('appKey', youdaoAppKey);
params.append('salt', salt);
params.append('sign', sign);
params.append('signType', 'v3');
params.append('curtime', curtime);

console.log('\n--- 请求参数 ---');
console.log(params.toString());
console.log('\n要验证签名，请执行:');
console.log(`curl -X POST 'https://openapi.youdao.com/api' --data "${params.toString()}" | cat`); 