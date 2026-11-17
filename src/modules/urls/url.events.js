export function createUrlClickedEvent(url, request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  const ipAddress = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : request.ip || null;

  return {
    event: 'url.clicked',
    urlId: url.id.toString(),
    shortCode: url.shortCode,
    clickedAt: new Date().toISOString(),
    ipAddress,
    userAgent: request.headers['user-agent'] ?? null,
    referer: request.headers.referer ?? request.headers.referrer ?? null,
  };
}
