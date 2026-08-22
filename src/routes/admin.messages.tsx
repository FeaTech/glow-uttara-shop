import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2, Mail, Search } from "lucide-react";
import { adminListContactMessages, adminDeleteContactMessage } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "Contact messages — Admin — FEA Glam" }] }),
  component: AdminMessages,
});

function AdminMessages() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    email: string;
    subject: string | null;
    message: string;
    created_at: string;
  } | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["admin", "contact-messages"],
    queryFn: () => adminListContactMessages({ data: undefined }),
    retry: false,
  });

  const deleteFn = useServerFn(adminDeleteContactMessage);
  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "contact-messages"] });
      toast.success("Message deleted");
      if (selected?.id) setSelected(null);
    },
    onError: (err: any) => toast.error(err?.message ?? "Delete failed"),
  });

  const filtered = (messages ?? []).filter((m) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.subject ?? "").toLowerCase().includes(q) ||
      m.message.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Contact messages</h1>
          <p className="mt-1 text-muted-foreground">{messages?.length ?? 0} messages from customers</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, subject…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card-luxe mt-8 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sender</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : !filtered.length ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {search ? "No messages match your search." : "No messages yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((m) => (
                <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(m)}>
                  <TableCell>
                    <p className="font-medium text-foreground">{m.name}</p>
                    <p className="text-sm text-muted-foreground">{m.email}</p>
                  </TableCell>
                  <TableCell className="max-w-xs text-foreground">{m.subject || "(no subject)"}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="truncate text-sm text-muted-foreground">{m.message}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Reply via email"
                        asChild
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject || "Your message to FEA Glam"}`)}`}>
                          <Mail className="h-4 w-4 text-primary" />
                        </a>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete" onClick={(e) => e.stopPropagation()}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                            <AlertDialogDescription>This message will be permanently removed from the inbox.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate({ data: { id: m.id } })}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.subject || "Message from customer"}</DialogTitle>
            <DialogDescription>
              From {selected?.name} · {selected?.email} · {selected ? formatDate(selected.created_at) : ""}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="whitespace-pre-wrap text-foreground">{selected.message}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(`Re: ${selected.subject || "Your message to FEA Glam"}`)}`}>
                    <Mail className="mr-2 h-4 w-4" /> Reply via email
                  </a>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate({ data: { id: selected.id } })}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
