export function ProductCardSkeleton() {
  return (
    <div className="card-luxe overflow-hidden">
      <div className="aspect-square skeleton-luxe" />
      <div className="space-y-3 p-4">
        <div className="h-2.5 w-16 rounded skeleton-luxe" />
        <div className="h-4 w-3/4 rounded skeleton-luxe" />
        <div className="h-3 w-24 rounded skeleton-luxe" />
        <div className="h-4 w-20 rounded skeleton-luxe" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
