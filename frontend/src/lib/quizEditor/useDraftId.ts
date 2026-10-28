"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { newDraftId } from "./drafts";

/**
 * The draft a «new» editor page works on: `?draft=<id>` from the address, or a fresh id written into
 * it, so a reload or a link from the dashboard reopens the same draft. Null until it is known.
 */
export function useDraftId(): string | null {
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("draft");
  const [id, setId] = useState<string | null>(fromUrl);

  useEffect(() => {
    if (fromUrl) {
      setId(fromUrl);
      return;
    }
    const fresh = newDraftId();
    setId(fresh);
    router.replace(`?draft=${fresh}`, { scroll: false });
  }, [fromUrl, router]);

  return id;
}
