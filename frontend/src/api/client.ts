import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 根据请求路径决定使用哪个 token
    const url = config.url || '';

    if (url.startsWith('/admin/')) {
      // 管理员接口使用管理员 token
      const adminToken = localStorage.getItem('admin_token');
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
    } else if (url.startsWith('/user/')) {
      // 用户接口使用用户 token
      const userToken = localStorage.getItem('user_token');
      if (userToken) {
        config.headers.Authorization = `Bearer ${userToken}`;
      }
    } else {
      // 其他接口（如公开接口），优先使用用户 token，其次管理员 token
      const userToken = localStorage.getItem('user_token');
      const adminToken = localStorage.getItem('admin_token');
      if (userToken) {
        config.headers.Authorization = `Bearer ${userToken}`;
      } else if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 不在拦截器中自动处理401，让各个页面自己处理
    return Promise.reject(error);
  }
);

export default api;
