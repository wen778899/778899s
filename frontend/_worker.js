export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 后端域名，请根据实际情况修改
    const backendUrl = "https://9526.ip-ddns.com";

    // 检查路径是否以/api/开头
    if (url.pathname.startsWith('/api/')) {
      const newUrlStr = backendUrl + url.pathname + url.search;
      const newUrl = new URL(newUrlStr);

      // 复制请求头，特别是cookie
      const newRequest = new Request(newUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow'
      });
      
      // 添加源站信息，某些服务器可能需要
      newRequest.headers.set('Origin', url.origin);
      
      try {
        const response = await fetch(newRequest);
        
        // 需要手动处理CORS响应头，即使请求是由worker发出的
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', url.origin);
        newHeaders.set('Access-Control-Allow-Credentials', 'true');

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
        
      } catch (e) {
        return new Response('Backend fetch failed: ' + e.toString(), { status: 500 });
      }
    }

    // 对于非/api/的请求，交由Cloudflare Pages静态资源处理器处理
    return env.ASSETS.fetch(request);
  }
};