import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2, Check } from "lucide-react";
import { adminListReviews, adminDeleteReview } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/RatingStars";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: "Reviews — Admin — FEAGlam" }] }),
  component: AdminReviews,
});

function AdminReviews() {
  const queryClient = useQueryClient();
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => adminListReviews({ data: undefined }),
    retry: false,
  });

  const deleteFn = useServerFn(adminDeleteReview);
  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "reviews"] }); toast.success("Review removed"); },
    onError: (err: any) => toast.error(err?.message ?? "Delete failed"),
  });

  return (
    <div>
      <h1 className="font-serif text-3xl font-light text-foreground">Reviews</h1>
      <p className="mt-1 text-muted-foreground">{reviews?.length ?? 0} reviews · moderate customer feedback</p>

      <div className="card-luxe mt-8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Review</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
            ) : !reviews?.length ? (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No reviews yet.</TableCell></TableRow>
            ) : (
              reviews.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.products?.slug ? (
                      <Link to="/products/$slug" params={{ slug: r.products.slug }} className="font-medium text-foreground hover:text-primary">
                        {r.products?.name ?? "Product"}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{r.products?.name ?? "Product"}</span>
                    )}
                  </TableCell>
                  <TableCell><RatingStars value={r.rating} /></TableCell>
                  <TableCell className="max-w-sm">
                    {r.title && <p className="font-medium text-foreground">{r.title}</p>}
                    {r.body && <p className="truncate text-sm text-muted-foreground">{r.body}</p>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.author_name || "Anonymous"}
                    {r.is_verified && (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" /> verified
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this review?</AlertDialogTitle>
                          <AlertDialogDescription>The review will be permanently deleted and the product's rating recalculated.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate({ data: { id: r.id } })}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
