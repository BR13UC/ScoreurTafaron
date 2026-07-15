export function isLoopbackAddress(address?: string) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '');
}
