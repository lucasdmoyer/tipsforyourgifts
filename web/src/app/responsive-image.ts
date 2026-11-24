export const responsiveImageFallback = (src: string) => src.endsWith('.webp')
  ? src.replace(/\.webp$/, '-1200.webp')
  : src;

export const responsiveImageSrcset = (src: string) => src.endsWith('.webp')
  ? `${src.replace(/\.webp$/, '-480.webp')} 480w, ${src.replace(/\.webp$/, '-768.webp')} 768w, ${src.replace(/\.webp$/, '-1200.webp')} 1200w, ${src} 1536w`
  : null;
