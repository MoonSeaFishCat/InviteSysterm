import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.ADMIN_SECRET || "l-invite-secret-key-12345");

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查并规范化 x-forwarded-host 请求头
  const forwardedHost = request.headers.get("x-forwarded-host");
  const origin = request.headers.get("origin");
  
  // 只在需要时修改 x-forwarded-host（当它与 origin 不匹配时）
  if (forwardedHost && origin) {
    const originHost = new URL(origin).host; // 包含端口的完整 host
    const forwardedHostClean = forwardedHost.split(":")[0]; // 去除端口的 host
    const originHostClean = originHost.split(":")[0]; // 去除端口的 host
    
    // 如果 host 部分相同，但端口不同，则将 x-forwarded-host 设置为与 origin 匹配
    if (forwardedHostClean === originHostClean && forwardedHost !== originHost) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-forwarded-host", originHost);

      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      // Protect /admin routes (except /admin/login)
      if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
        const session = request.cookies.get("admin_session")?.value;

        if (!session) {
          return NextResponse.redirect(new URL("/admin/login", request.url));
        }

        try {
          await jwtVerify(session, SECRET);
          return response;
        } catch (error) {
          return NextResponse.redirect(new URL("/admin/login", request.url));
        }
      }

      return response;
    }
  }

  // 正常的认证检查
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = request.cookies.get("admin_session")?.value;

    if (!session) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      await jwtVerify(session, SECRET);
      return NextResponse.next();
    } catch (error) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，除了：
     * - api (API routes)
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
