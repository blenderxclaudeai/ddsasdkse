import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ExtensionLayout } from "@/components/ExtensionLayout";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = [
  { key: "full_body" as const, label: "Full Body" },
  { key: "face" as const, label: "Face" },
  { key: "hair" as const, label: "Hair" },
  { key: "hands_wrist" as const, label: "Hands" },
];

type PhotoCategory = "full_body" | "face" | "hair" | "hands_wrist";

interface PhotoRecord {
  id: string;
  category: PhotoCategory;
  storage_path: string;
  signedUrl?: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const loadPhotos = async () => {
    if (!user) return;
    const { data } = await supabase.from("profile_photos").select("*").eq("user_id", user.id);
    if (data) {
      const withUrls = await Promise.all(
        data.map(async (p: any) => {
          const { data: urlData } = await supabase.storage.from("profile-photos").createSignedUrl(p.storage_path, 3600);
          return { ...p, signedUrl: urlData?.signedUrl } as PhotoRecord;
        })
      );
      setPhotos(withUrls);
    }
    setLoading(false);
  };

  useEffect(() => { loadPhotos(); }, [user]);

  const handleUpload = async (category: PhotoCategory, file: File) => {
    if (!user) return;
    setUploading(category);
    const path = `${user.id}/${category}-${Date.now()}`;

    const existing = photos.find(p => p.category === category);
    if (existing) {
      await supabase.storage.from("profile-photos").remove([existing.storage_path]);
      await supabase.from("profile_photos").delete().eq("id", existing.id);
    }

    const { error: uploadErr } = await supabase.storage.from("profile-photos").upload(path, file);
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      setUploading(null);
      return;
    }

    const { error: dbErr } = await supabase.from("profile_photos").insert({
      user_id: user.id,
      category,
      storage_path: path,
    });
    if (dbErr) toast({ title: "Error saving photo", description: dbErr.message, variant: "destructive" });
    else toast({ title: "Photo uploaded" });
    setUploading(null);
    loadPhotos();
  };

  const handleDelete = async (photo: PhotoRecord) => {
    await supabase.storage.from("profile-photos").remove([photo.storage_path]);
    await supabase.from("profile_photos").delete().eq("id", photo.id);
    toast({ title: "Photo deleted" });
    loadPhotos();
  };

  return (
    <ExtensionLayout>
      <div className="p-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Your Photos</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Upload photos for virtual try-on</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {CATEGORIES.map(cat => {
            const photo = photos.find(p => p.category === cat.key);
            return (
              <div key={cat.key} className="group relative">
                {loading ? (
                  <div className="aspect-square animate-pulse rounded-xl bg-secondary" />
                ) : photo?.signedUrl ? (
                  <div className="relative">
                    <img
                      src={photo.signedUrl}
                      alt={cat.label}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-xl bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100">
                      <label className="cursor-pointer rounded-lg bg-background/90 px-3 py-1.5 text-[11px] font-medium text-foreground transition-opacity hover:opacity-80">
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cat.key, e.target.files[0])} />
                        Replace
                      </label>
                      <button
                        onClick={() => handleDelete(photo)}
                        className="rounded-lg bg-destructive/90 px-3 py-1.5 text-[11px] font-medium text-destructive-foreground transition-opacity hover:opacity-80"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl bg-secondary text-muted-foreground transition-colors hover:bg-secondary/70">
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cat.key, e.target.files[0])} />
                    {uploading === cat.key ? (
                      <span className="text-[12px]">Uploading…</span>
                    ) : (
                      <>
                        <span className="text-[20px] leading-none">+</span>
                        <span className="mt-1 text-[11px] font-medium">{cat.label}</span>
                      </>
                    )}
                  </label>
                )}
                {photo?.signedUrl && (
                  <p className="mt-1.5 text-center text-[11px] font-medium text-muted-foreground">{cat.label}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ExtensionLayout>
  );
}
