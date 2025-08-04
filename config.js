// 配置文件
const config = {
    // Dify API配置
    DIFY_API_KEY: process.env.DIFY_API_KEY || 'app-REDACTED',
    DIFY_API_BASE_URL: process.env.DIFY_API_BASE_URL || 'https://api.dify.ai/v1',
    
    // 服务器配置
    PORT: process.env.PORT || 3000
};

// 支持两种导出方式，兼容 CommonJS 和 ES 模块
export default config;
module.exports = config;