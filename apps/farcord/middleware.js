import { rewrite } from "@vercel/edge";

export const config = {
  matcher: "/hub/*",
};

export function middleware(request) {
  // Clone the request headers
  // You can modify them with headers API: https://developer.mozilla.org/en-US/docs/Web/API/Headers
  const requestHeaders = new Headers(request.headers);

  // Add new request headers
  requestHeaders.set("x-hello-from-middleware1", "hello");
  requestHeaders.set("x-hello-from-middleware2", "world!");

  //   return Response.redirect(new URL("/hub-2", request.url));
  return rewrite(new URL("/about-2", request.url));
}
