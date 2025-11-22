export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. 如果请求路径不是以 /api/ 开头，则是静态资源（JS/CSS/HTML），直接返回
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    // 2. 处理 API 请求
    // 提取 endpoint，例如 "/api/login" -> "login"
    const endpoint = url.pathname.replace('/api/', '');

    // 构建真实的 HTTP 后端地址
    // 注意：这里硬编码了你的 HTTP 后端地址
    const backendBaseUrl = 'http://9526.ip-ddns.com/index.php';
    const backendUrl = new URL(backendBaseUrl);
    backendUrl.searchParams.set('endpoint', endpoint);

    // 3. 构建代理请求
    // 必须保留原始请求的 Method, Headers (包括 Cookie) 和 Body
    const proxyRequestInit = {
      method: request.method,
      headers: new Headers(request.headers),
      redirect: 'follow'
    };

    // 如果有 Body (POST/PUT)，则复制
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      proxyRequestInit.body = request.body;
    }

    // Cloudflare Worker 发出请求时，Host 头必须指向目标服务器
    proxyRequestInit.headers.set('Host', '9526.ip-ddns.com');
    // 告诉后端这是通过代理来的，有些后端框架需要
    proxyRequestInit.headers.set('X-Forwarded-Proto', 'https'); 

    try {
      // 4. 服务器间通信 (Cloudflare -> Serv00)
      // 这一步是 HTTP 请求，但因为是在服务器端发生的，浏览器不知道，所以不会报错
      const backendResponse = await fetch(backendUrl.toString(), proxyRequestInit);

      // 5. 处理响应头
      // 我们需要构造一个新的 Response 返回给浏览器
      const responseHeaders = new Headers(backendResponse.headers);

      // 关键：处理 CORS 和 Cookie
      // 因为我们是在同源（Same-Origin）代理，前端访问的是 /api/...
      // 浏览器认为这是同一个网站，所以不需要复杂的 CORS 头
      // 但我们需要确保 Set-Cookie 正常传递
      responseHeaders.set('Access-Control-Allow-Origin', url.origin);
      responseHeaders.set('Access-Control-Allow-Credentials', 'true');

      return new Response(backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        status: 'error', 
        message: 'Proxy Error: ' + error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};