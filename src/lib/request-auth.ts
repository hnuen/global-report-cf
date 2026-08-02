export function hasSecret(request: Request, secret: string | undefined, headerName: string): boolean {
  if (!secret) return false;
  return request.headers.get(headerName) === secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

export function hasAnySecret(request: Request, secrets: Array<string | undefined>, headerName: string): boolean {
  return secrets.some(secret => hasSecret(request, secret, headerName));
}
