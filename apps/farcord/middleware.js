export const config = {
  matcher: "/hub/:path*",
};

export function middleware(request) {
  console.log("request caught by middleware");

  const requestHeaders = new Headers(request.headers);

  // Add new request headers
  requestHeaders.set("x-hello-from-middleware1", "hello");
  requestHeaders.set("x-hello-from-middleware2", "world!");

  return Response.redirect(new URL("/hub-2", request.url));
}
