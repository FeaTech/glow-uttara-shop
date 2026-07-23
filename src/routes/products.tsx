import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/products")({
  component: ProductsLayout,
});

function ProductsLayout() {
  return <Outlet />;
}
