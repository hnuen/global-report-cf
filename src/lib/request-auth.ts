export function hasSecret(request: Request, secret: string | undefined, headerName: string): boolean {
  if (!secret) return false;
  return request.headers.get(headerName) === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

