export const isVideoFile = (name: string): boolean =>
  /\.(mp4|mkv|avi|mov|webm|flv|m4v)$/i.test(name)
