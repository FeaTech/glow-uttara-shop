import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Upload an image to the public `product-images` bucket and return its public URL.
 * Storage RLS restricts writes to admins; the browser client sends the user's JWT.
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > MAX_BYTES) throw new Error("Image must be under 5 MB");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${crypto.randomUUID()}.${ext || "jpg"}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
