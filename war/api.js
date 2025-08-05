/**
 * API管理模块
 * 统一管理后端API请求
 */

// API基础URL，可以根据环境配置
// 使用明确的后端API服务器地址，而不是前端静态服务器
const API_BASE_URL = 'http://192.168.1.103:8088'; // 默认使用本地开发服务器

// 如果需要在不同环境中切换，可以取消注释下面的代码
// const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168');
// const API_BASE_URL = isProduction ? 'https://api.example.com' : 'http://localhost:8080';


// 统一处理请求头
const getHeaders = (needAuth = false) => {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    // 如果需要认证，添加token
    if (needAuth) {
        const token = localStorage.getItem('eda_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }
    
    return headers;
};

// 统一处理请求
const request = async (url, options = {}) => {
    try {
        // 添加跨域支持
        options.mode = 'cors';
        // 在跨域请求中，只有在确实需要发送凭据时才设置为'include'
        // 对于大多数API请求，'same-origin'更安全
        options.credentials = 'same-origin';
        
        // 添加超时处理
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
        options.signal = controller.signal;
        
        const response = await fetch(`${API_BASE_URL}${url}`, options);
        clearTimeout(timeoutId); // 清除超时
        
        // 处理非2xx响应
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = '无法获取错误详情';
            }
            throw new Error(`请求失败: ${response.status} ${response.statusText}\n${errorText}`);
        }
        
        // 解析JSON响应
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API请求错误:', error);
        // 针对网络连接问题提供更友好的错误信息
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请检查网络连接');
        } else if (error.message.includes('Failed to fetch')) {
            throw new Error('无法连接到服务器，请检查网络连接或服务器状态');
        }
        throw error;
    }
};

// API模块
const API = {
    /**
     * 用户登录
     * @param {Object} loginData - 登录数据
     * @param {string} loginData.username - 用户名
     * @param {string} loginData.password - 密码
     * @param {boolean} loginData.rememberMe - 记住我
     * @returns {Promise} - 登录结果
     */
    login: (loginData) => {
        return request('/eda/login', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(loginData)
        });
    },
    
    /**
     * 验证Token
     * @returns {Promise} - 验证结果
     */
    validateToken: () => {
        return request('/eda/login/validate', {
            method: 'GET',
            headers: getHeaders(true)
        });
    },
    
    /**
     * 用户注销
     * @returns {Promise} - 注销结果
     */
    logout: () => {
        return request('/eda/login', {
            method: 'DELETE',
            headers: getHeaders(true)
        });
    },
    
    /**
     * 用户注册
     * @param {Object} registerData - 注册数据
     * @param {string} registerData.username - 用户名
     * @param {string} registerData.password - 密码
     * @param {string} registerData.confirmPassword - 确认密码
     * @param {string} registerData.activationCode - 激活码
     * @param {string} registerData.email - 邮箱（可选）
     * @param {string} registerData.phone - 手机号（可选）
     * @param {string} registerData.realName - 真实姓名（可选）
     * @returns {Promise} - 注册结果
     */
    register: (registerData) => {
        return request('/eda/register', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(registerData)
        });
    },
    
    /**
     * 验证激活码
     * @param {string} code - 激活码
     * @returns {Promise} - 验证结果
     */
    validateActivationCode: (code) => {
        return request(`/eda/register/validate-code/${code}`, {
            method: 'GET',
            headers: getHeaders()
        });
    },
    
    /**
     * 检查用户名是否可用
     * @param {string} username - 用户名
     * @returns {Promise} - 检查结果
     */
    checkUsername: (username) => {
        return request(`/eda/register/check-username/${username}`, {
            method: 'GET',
            headers: getHeaders()
        });
    },
    
    /**
     * 验证账户找回激活码
     * @param {string} code - 激活码
     * @returns {Promise} - 验证结果
     */
    validateRecoveryCode: (code) => {
        return request(`/eda/recover/validate-code/${code}`, {
            method: 'GET',
            headers: getHeaders()
        });
    },
    
    /**
     * 重置账户信息
     * @param {Object} resetData - 重置数据
     * @param {string} resetData.username - 新用户名
     * @param {string} resetData.password - 新密码
     * @param {string} resetData.confirmPassword - 确认密码
     * @param {string} resetData.activationCode - 激活码
     * @returns {Promise} - 重置结果
     */
    resetAccount: (resetData) => {
        return request('/eda/recover/reset', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(resetData)
        });
    },
    
    /**
     * 获取用户个人资料
     * @param {number} userId - 用户ID
     * @returns {Promise} - 用户资料
     */
    getUserProfile: (userId) => {
        return request(`/eda/profile/${userId}`, {
            method: 'GET',
            headers: getHeaders(true)
        });
    },
    
    /**
     * 获取当前登录用户的资料
     * @param {string} username - 当前登录的用户名
     * @returns {Promise} - 当前用户资料
     */
    getCurrentUserProfile: (username) => {
        const url = username ? `/eda/profile/current?username=${encodeURIComponent(username)}` : '/eda/profile/current';
        return request(url, {
            method: 'GET',
            headers: getHeaders(true)
        });
    },
    
    /**
     * 更新用户个人资料
     * @param {number} userId - 用户ID
     * @param {Object} profileData - 个人资料数据
     * @returns {Promise} - 更新结果
     */
    updateUserProfile: (userId, profileData) => {
        return request(`/eda/profile/${userId}`, {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify(profileData)
        });
    },
    
    /**
     * 修改密码
     * @param {number} userId - 用户ID
     * @param {Object} passwordData - 密码数据
     * @param {string} passwordData.oldPassword - 原密码
     * @param {string} passwordData.newPassword - 新密码
     * @param {string} passwordData.confirmPassword - 确认密码
     * @returns {Promise} - 修改结果
     */
    updatePassword: (userId, passwordData) => {
        return request(`/eda/profile/${userId}/password`, {
            method: 'PUT',
            headers: getHeaders(true),
            body: JSON.stringify(passwordData)
        });
    }
};

// API连接状态检测函数
API.checkConnection = () => {
    console.log('正在检测API连接状态...');
    return fetch(`${API_BASE_URL}/actuator/health`, {
        method: 'GET',
        mode: 'cors',
        headers: { 'Accept': 'application/json' }
    })
    .then(response => {
        if (response.ok) {
            console.log('API服务器连接正常');
            return response.json();
        } else {
            console.error('API服务器连接异常:', response.status, response.statusText);
            throw new Error(`API服务器连接异常: ${response.status} ${response.statusText}`);
        }
    })
    .catch(error => {
        console.error('API连接检测失败:', error);
        throw error;
    });
};
