import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PLACEHOLDER_IMAGE, handleImageError } from "@/lib/format";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/upload";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
};

const SIGN_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_MS = (SIGN_TTL_SECONDS - 60) * 1000;
const cache = new Map<string, { url: string; expires: number }>();
const pending = new Map<string, Promise<string>>();

/** Extract a storage path from either a bare path or a legacy public/signed URL. */
function extractPath(value: string): string | null {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return value;
  const marker = `/${PRODUCT_IMAGE_BUCKET}/`;
  const i = value.indexOf(marker);
  if (i === -1) return null; // external URL — use as-is
  const rest = value.slice(i + marker.length);
  // Strip any leading "public/" or "sign/" segment plus query string.
  const cleaned = rest.replace(/^(public|sign)\//, "").split("?")[0];
  return cleaned || null;
}

async function signPath(path: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(path);
  if (hit && hit.expires > now + 30_000) return hit.url;
  const existing = pending.get(path);
  if (existing) return existing;

  const p = (async () => {
    const { data, error } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .createSignedUrl(path, SIGN_TTL_SECONDS);
    if (error || !data?.signedUrl) throw error ?? new Error("sign failed");
    cache.set(path, { url: data.signedUrl, expires: now + REFRESH_MS });
    return data.signedUrl;
  })();
  pending.set(path, p);
  try {
    return await p;
  } finally {
    pending.delete(path);
  }
}

export function ProductImage({ src, alt = "", ...rest }: Props) {
  const path = src ? extractPath(src) : null;
  const isExternal = !!src && /^https?:\/\//i.test(src) && !path;
  const initial = isExternal ? src! : path ? cache.get(path)?.url ?? "" : PLACEHOLDER_IMAGE;
  const [resolved, setResolved] = useState<string>(initial);

  useEffect(() => {
    let cancelled = false;
    if (!src) {
      setResolved(PLACEHOLDER_IMAGE);
      return;
    }
    if (isExternal) {
      setResolved(src);
      return;
    }
    if (!path) {
      setResolved(PLACEHOLDER_IMAGE);
      return;
    }
    signPath(path)
      .then((u) => !cancelled && setResolved(u))
      .catch(() => !cancelled && setResolved(PLACEHOLDER_IMAGE));
    return () => {
      cancelled = true;
    };
  }, [src, path, isExternal]);

  return <img {...rest} alt={alt} src={resolved || PLACEHOLDER_IMAGE} onError={handleImageError} />;
}
