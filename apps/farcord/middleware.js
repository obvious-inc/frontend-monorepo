import { rewrite } from "@vercel/edge";

export const config = {
  matcher: "/hub/:path*",
};

export default function middleware(request) {
  // Clone the request headers
  // You can modify them with headers API: https://developer.mozilla.org/en-US/docs/Web/API/Headers
  const requestHeaders = new Headers(request.headers);

  // Add new request headers
  requestHeaders.set("x-hello-from-middleware1", "hello");
  requestHeaders.set("x-hello-from-middleware2", "world!");

  return rewrite(new URL("/hub-2", request.url));
}
