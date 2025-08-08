/**
 * API管理模块
 * 统一管理后端API请求
 */

// API基础URL，可以根据环境配置
// 使用明确的后端API服务器地址，而不是前端静态服务器
// const API_BASE_URL = window.location.protocol + '//' + window.location.hostname + ':8088'; // 默认使用本地开发服务器

// 如果需要在不同环境中切换，可以取消注释下面的代码
const isProduction = window.location.hostname !== 'localhost' && !window.location.hostname.includes('192.168');
const API_BASE_URL = isProduction ? 'https://apisim.cycore.com.cn' : 'http://192.168.1.103:8088';

// 获取有效的token，确保格式正确
const getValidToken = () => {
  let token = localStorage.getItem('eda_token');
  // 如果token存在，确保没有额外的空格和换行符
  if (token) {
    token = token.trim();
    console.log("获取到的token长度: " + token.length + ", 前10个字符: " + 
      (token.length > 10 ? token.substring(0, 10) + "..." : token));
  }
  return token;
};

// 统一处理请求头
const getHeaders = (needAuth = false) => {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    // 如果需要认证，添加token
    if (needAuth) {
        const token = getValidToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log("请求添加Authorization头部");
        } else {
            console.warn("需要认证但未找到有效token");
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
        
        // 处理HTTP 401 Unauthorized - JWT认证错误
        if (response.status === 401) {
            // 尝试获取详细错误信息
            let errorDetail;
            try {
                const errorResponse = await response.json();
                errorDetail = errorResponse.msg || errorResponse.message || '认证失败';
            } catch (e) {
                errorDetail = '认证失败';
            }
            
            // 如果是JWT错误，特别处理
            if (errorDetail.includes('JWT')) {
                console.warn('JWT认证错误:', errorDetail);
                // 清理失效的令牌
                if (needsAuth(url)) {
                    console.log('清理失效的认证信息');
                }
                throw new Error(`认证失败 (JWT): ${errorDetail}`);
            } else {
                throw new Error(`认证失败: ${errorDetail}`);
            }
        }
        
        // 处理其他非2xx响应
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
            throw new Error('网络连接失败，请检查您的互联网连接');
        }
        throw error;
    }
};

// 判断URL是否需要认证
function needsAuth(url) {
    // 不需要认证的URL
    const noAuthUrls = ['/eda/login', '/eda/register', '/actuator/health'];
    return !noAuthUrls.some(noAuth => url.startsWith(noAuth));
}

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
        })
        .then(response => {
            // 保存用户信息到本地存储
            if (response.code === 200 && response.data) {
                localStorage.setItem('eda_user_info', JSON.stringify(response.data));
                localStorage.setItem('eda_token', response.data.token);
            }
            return response;
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
    },
    
    /**
     * 保存电路
     * @param {Object} circuitData - 电路信息
     * @param {number} circuitData.userId - 用户ID
     * @param {string} circuitData.circuitName - 电路名称
     * @param {string} circuitData.circuitData - 电路数据
     * @param {string} circuitData.description - 电路描述 (可选)
     * @param {string} circuitData.isPublic - 是否公开 (默认为'0'-私有)
     * @returns {Promise} - 保存结果
     */
    saveCircuit: (circuitData) => {
        console.log("API.saveCircuit被调用", circuitData.userId, circuitData.circuitName);
        return request('/cycore/circuit/save', {
            method: 'POST',
            headers: getHeaders(true),  // 确保传入true，表示需要认证
            body: JSON.stringify(circuitData)
        });
    },
    
    /**
     * 获取电路详情
     * @param {number} circuitId - 电路ID
     * @returns {Promise} - 电路详情
     */
    getCircuit: (circuitId) => {
        return request(`/cycore/circuit/${circuitId}`, {
            method: 'GET',
            headers: getHeaders(true)
        });
    },
    
    /**
     * 获取用户电路列表
     * @param {number} userId - 用户ID
     * @param {Object} options - 选项
     * @param {number} options.limit - 每页记录数
     * @param {number} options.offset - 起始位置
     * @returns {Promise} - 电路列表
     */
    getUserCircuits: (userId, options = {}) => {
        const limit = options.limit || 10;
        const offset = options.offset || 0;
        
        return request(`/cycore/circuit/user/${userId}?limit=${limit}&offset=${offset}`, {
            method: 'GET',
            headers: getHeaders(true)
        });
    },
    
    /**
     * 获取当前登录用户的电路列表
     * @param {Object} options - 选项
     * @param {number} options.limit - 每页记录数
     * @param {number} options.offset - 起始位置
     * @returns {Promise} - 电路列表
     */
    getCurrentUserCircuits: (options = {}) => {
        const limit = options.limit || 10;
        const offset = options.offset || 0;
        
        // 添加直接请求日志
        console.log(`直接请求getCurrentUserCircuits: limit=${limit}, offset=${offset}`);
        console.log("当前token:", getValidToken() ? getValidToken().substring(0, 10) + "..." : null);
        
        // 如果没有token，尝试从localStorage获取
        const token = getValidToken();
        if (!token) {
            console.error("获取电路列表失败：未找到有效token");
            return Promise.reject(new Error("未登录，请先登录"));
        }
        
        // 构建URL
        const url = `/cycore/circuit/user/current?limit=${limit}&offset=${offset}`;
        
        // 添加重试和详细错误处理
        return new Promise((resolve, reject) => {
            request(url, {
                method: 'GET',
                headers: getHeaders(true)
            })
            .then(response => {
                console.log("getCurrentUserCircuits 响应:", response);
                resolve(response);
            })
            .catch(error => {
                console.error("getCurrentUserCircuits 错误:", error);
                
                // 如果是401错误，尝试刷新token后重试
                if (error.message && (error.message.includes('401') || error.message.includes('JWT'))) {
                    console.log("尝试刷新token后重试请求");
                    
                    API.refreshToken()
                        .then(refreshResult => {
                            console.log("token刷新结果:", refreshResult);
                            
                            // 使用新token重试请求
                            return request(url, {
                                method: 'GET',
                                headers: getHeaders(true)
                            });
                        })
                        .then(retryResponse => {
                            console.log("重试请求响应:", retryResponse);
                            resolve(retryResponse);
                        })
                        .catch(retryError => {
                            console.error("重试失败:", retryError);
                            reject(new Error("认证失败，请重新登录"));
                        });
                } else {
                    reject(error);
                }
            });
        });
    },
    
    /**
     * 获取公开电路列表
     * @param {Object} options - 选项
     * @param {number} options.limit - 每页记录数
     * @param {number} options.offset - 起始位置
     * @returns {Promise} - 公开电路列表
     */
    getPublicCircuits: (options = {}) => {
        const limit = options.limit || 10;
        const offset = options.offset || 0;
        
        return request(`/cycore/circuit/public?limit=${limit}&offset=${offset}`, {
            method: 'GET',
            headers: getHeaders(true)
        });
    },
    
    /**
     * 删除电路
     * @param {number} circuitId - 电路ID
     * @param {number} userId - 用户ID
     * @returns {Promise} - 删除结果
     */
    deleteCircuit: (circuitId, userId) => {
        return request(`/cycore/circuit/${circuitId}?userId=${userId}`, {
            method: 'DELETE',
            headers: getHeaders(true)
        });
    }
};

// 检查连接
API.checkConnection = function() {
  return API.request('/ping', {
    method: 'GET',
    credentials: 'same-origin'
  }, 2000);
};

// 验证令牌
API.validateToken = function() {
  return API.request('/eda/login/validate', {
    method: 'GET'
  });
};

// 刷新令牌
API.refreshToken = function() {
  console.log("尝试刷新令牌");
  // 获取保存的用户名和密码（如果有）
  const savedUsername = localStorage.getItem('saved_username');
  const savedPassword = localStorage.getItem('saved_password');

  if (!savedUsername || !savedPassword) {
    console.log("没有保存的登录信息，无法自动刷新令牌");
    return Promise.reject(new Error("需要重新登录"));
  }

  try {
    // 解码密码
    const decodedPassword = atob(savedPassword);
    
    // 使用保存的凭证自动登录
    return API.login({
      username: savedUsername,
      password: decodedPassword,
      rememberMe: true
    })
    .then(response => {
      if (response.code === 200) {
        console.log("令牌刷新成功");
                        // 确保更新本地存储的令牌和用户信息
                if (response.data) {
                  // 确保token格式一致，不含额外字符
                  const token = response.data.token ? response.data.token.trim() : response.data.token;
                  localStorage.setItem('eda_user', JSON.stringify(response.data));
                  localStorage.setItem('eda_token', token);
                }
        return response;
      } else {
        console.error("自动登录失败:", response.msg);
        return Promise.reject(new Error(response.msg || "自动登录失败"));
      }
    });
  } catch (error) {
    console.error("解码密码或自动登录过程出错:", error);
    return Promise.reject(new Error("自动登录过程出错"));
  }
};

// 通用请求包装函数，处理JWT失效问题
API.request = function(url, options = {}, timeout = 10000) {
  // 检查是否需要添加认证令牌
  const needsAuth = url !== '/eda/login' && 
                    url !== '/ping' && 
                    url !== '/eda/register' && 
                    url !== '/eda/recover' && 
                    !url.startsWith('/captcha');
  
  // 如果需要认证，添加token到请求头
  if (needsAuth) {
    const token = getValidToken();
    
    if (!token) {
      console.warn("请求需要认证但未找到令牌");
      // 非关键请求，可以继续尝试
    } else {
      if (!options.headers) options.headers = {};
      options.headers['Authorization'] = 'Bearer ' + token;
    }
  }

  // 默认使用JSON格式
  if (!options.headers) options.headers = {};
  options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';

  // 创建请求Promise
  const fetchPromise = fetch(API_BASE_URL + url, options)
    .then(response => {
      // 检查请求是否成功
      if (!response.ok) {
        console.warn(`API请求失败: ${response.status} ${response.statusText}, URL=${url}`);
        
        // 特殊处理401错误（认证失败）
        if (response.status === 401) {
          console.warn("认证失败，HTTP状态码：401");
          
          // 尝试获取详细错误信息
          return response.json().then(errorData => {
            const errorDetail = errorData.msg || errorData.message || "认证失败";
            console.warn("认证错误详情:", errorDetail);
            
            // 如果是JWT错误，记录并抛出特定错误
            if (errorDetail.includes("JWT") || errorDetail.includes("token")) {
              localStorage.setItem('auth_error', errorDetail);
              
              // 自动尝试刷新令牌
              if (needsAuth) {
                console.log("检测到JWT错误，尝试自动刷新令牌");
                // 返回刷新令牌并重试请求的承诺
                return API.refreshToken().then(refreshResponse => {
                  // 令牌已刷新，使用新令牌重试原始请求
                  if (!options.headers) options.headers = {};
                  const token = localStorage.getItem('eda_token');
                  // 确保token格式一致，不含额外字符
                  const cleanToken = token ? token.trim() : token;
                  options.headers['Authorization'] = 'Bearer ' + cleanToken;
                  console.log("使用新令牌重试请求:", url);
                  return fetch(API_BASE_URL + url, options)
                    .then(retryResponse => {
                      if (!retryResponse.ok) {
                        throw new Error("重试请求失败: " + retryResponse.status);
                      }
                      return retryResponse.json();
                    });
                }).catch(refreshError => {
                  // 刷新令牌失败，抛出认证错误
                  throw new Error("认证失败 (JWT): " + errorDetail);
                });
              } else {
                // 非认证请求，直接抛出错误
                throw new Error("认证失败 (JWT): " + errorDetail);
              }
            } else {
              // 其他401错误
              throw new Error("认证失败: " + errorDetail);
            }
          }).catch(e => {
            if (e.message && e.message.includes("JSON")) {
              // JSON解析失败，可能是非JSON响应
              throw new Error("认证失败 (401)");
            } else {
              throw e; // 重新抛出已处理的错误
            }
          });
        }
        
        // 处理其他HTTP错误
        const errorMessage = `请求失败: HTTP ${response.status} - ${url}`;
        console.error(errorMessage);
        throw new Error(errorMessage);
      }
      
      return response.json();
    });

  // 添加超时处理
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("请求超时")), timeout);
  });

  // 返回竞争Promise
  return Promise.race([fetchPromise, timeoutPromise]);
};

// 导出API模块
window.API = API;

// 添加token工具函数到API对象
window.API.getValidToken = getValidToken;

// 暴露 API 基础地址到全局与 API 对象
window.API.API_BASE_URL = API_BASE_URL;
window.API_BASE_URL = API_BASE_URL;
