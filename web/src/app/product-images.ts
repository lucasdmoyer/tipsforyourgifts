import type { Article, Product } from './content.types';
import images from '../../visuals/product-images.json';

const exactImages = new Map(images.items.map((image) => [`${image.articleSlug}/${image.productId}`, image]));

export function exactProductImage(articleSlug: string, productId: string) {
  return exactImages.get(`${articleSlug}/${productId}`);
}

export function productDestinationName(product: Product) {
  // Steam is the activation platform for this edition; the actual destination
  // is the 2K storefront. Do not change the vetted target or product name.
  return product.id === 'civilization-vi-windows-steam' && product.url.startsWith('https://store.2k.com/') ? '2K Store' : product.merchant;
}

export function officialProductImages(article: Article) {
  return images.items.flatMap((image) => {
    if (image.articleSlug !== article.slug) return [];
    const product = article.products.find(({ id }) => id === image.productId);
    const fragment = article.pairs.find((pair) => pair.anchorProductId === product?.id || pair.companionProductId === product?.id)?.id ?? product?.id;
    return product && fragment ? [{ image, product, fragment }] : [];
  });
}
