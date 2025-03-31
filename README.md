# 雨神无敌翻译1.0 Chrome 扩展

这是一个简单的 Chrome 扩展，可以自动将您鼠标选中的文本翻译成中文。

## 功能

- 自动检测鼠标选中的文本
- 立即翻译成中文并在附近显示
- 支持右键菜单翻译功能
- 简洁的用户界面
- **默认使用有道翻译API**（提供更准确的翻译结果）
- 备选谷歌翻译API作为后备选项
- **有道API已预先配置**，无需手动设置，开箱即用！

## 安装说明

### 从 Chrome 网上应用店安装（推荐）

1. 此扩展尚未上传到 Chrome 网上应用店

### 手动安装（开发模式）

1. 下载或克隆此仓库到本地
2. 打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/`
3. 在右上角启用"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择包含此扩展的文件夹
6. 安装完成后，您会在工具栏看到扩展图标

## 使用方法

1. 使用鼠标在任意网页上选择文本
2. 选择完成后，翻译结果会自动显示在选择的文本附近
3. 也可以右键选中的文本，选择"雨神无敌翻译"

## 预配置说明

本扩展已经预先配置了有道翻译API密钥，您可以直接使用，无需任何额外设置：

- 应用ID(AppKey): 1335e8b48d7ec6a9
- 应用密钥(AppSecret): 20010803

如果您想使用自己的API密钥，可以在扩展设置中进行更改。

## 翻译API设置

本扩展支持两种翻译API：

### 有道翻译API（默认，已预配置）

- 已预先配置好密钥，无需申请，可直接使用
- 翻译质量优秀，有详细的API文档
- 每个月有免费额度，超出后需付费

### 谷歌翻译API（备选）

- 免费使用，无需申请密钥
- 有调用频率限制
- 可能在某些地区无法访问
- 作为备选或在有道API不可用时自动使用

## 如何修改API密钥（可选）

如果您想使用自己的有道API密钥：

1. 点击扩展图标，切换到"设置"选项卡
2. 确保"使用有道翻译API"已被选中
3. 在应用ID和应用密钥输入框中输入您的新密钥
4. 点击"保存设置"

## 如何申请自己的有道API密钥（可选）

1. 访问[有道智云开放平台官网](https://ai.youdao.com/)
2. 点击右上角的"注册/登录"按钮
3. 可以使用手机号、邮箱或第三方账号进行注册
4. 完成注册并登录账号
5. 在控制台页面点击"创建应用"
6. 填写应用信息并开通文本翻译服务
7. 获取应用ID和应用密钥

## 注意事项

- 扩展已预先配置有道API密钥，无需手动设置即可使用
- 如果预设的API密钥额度用尽，您可以切换到谷歌翻译API或配置自己的有道API密钥
- 有道翻译API需要网络连接
- 谷歌翻译API使用的是非官方API，可能会有调用限制
- 如果翻译失败，请稍后再试或切换API

## 隐私说明

- 本扩展仅在您选择文本时发送翻译请求
- 不会收集或存储您的浏览历史或个人信息
- 不包含任何广告或跟踪代码
- 您的有道API密钥仅存储在本地，用于API调用

## 反馈和贡献

如果您有任何问题或建议，欢迎提交 Issue 或 Pull Request。 