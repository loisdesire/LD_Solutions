import type { Metadata } from 'next';

// This is a nested layout, not a root one — it still lives inside the same
// <html>/<body> as the booking product (app/layout.tsx), it doesn't redeclare
// them. That's fine: the `shop-root` wrapper class is the isolation point for
// this product's own fonts/design tokens once the design comes back, so it
// never inherits the booking app's Fraunces/mono/warm-paper system by
// accident. Once a real domain exists, middleware will rewrite requests to
// shop.ldsolutions.com into this /shop path prefix, so nothing here needs to
// change when that happens — this is already the right shape for that.
export const metadata: Metadata = {
  title: 'LD Solutions — Shop',
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <div className="shop-root">{children}</div>;
}
