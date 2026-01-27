import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.ADMIN_SECRET || "l-invite-secret-key-12345");

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 规范化 x-forwarded-host 请求头，去除端口号以匹配 origin
  // 这解决了生产环境中 Server Actions 的 x-forwarded-host 与 origin 不匹配的问题
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const hostWithoutPort = forwardedHost.split(":")[0];
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-forwarded-host", hostWithoutPort);

    // 创建响应并传递修改后的请求头
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

  // 没有 forwarded host 的情况，执行正常的认证检查
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
