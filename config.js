// 配置文件
// 注意：dotenv 在 server.js 中加载，Vercel 环境通过控制台设置环境变量
const config = {
    // Kimi K2.5 (Moonshot AI) 配置
    MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY || '',
    MOONSHOT_API_BASE_URL: process.env.MOONSHOT_API_BASE_URL || 'https://api.moonshot.cn/v1',
    MOONSHOT_MODEL: process.env.MOONSHOT_MODEL || 'kimi-k2.5',

    // 服务器配置
    PORT: process.env.PORT || 3000
};

module.exports = config;
