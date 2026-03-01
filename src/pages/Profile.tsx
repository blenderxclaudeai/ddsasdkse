import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ExtensionLayout } from "@/components/ExtensionLayout";
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const CATEGORIES = [
  { key: "full_body" as const, label: "Full Body" },
  { key: "face" as const, label: "Face" },
  { key: "upper_body" as const, label: "Upper Body" },
  { key: "lifestyle" as const, label: "Lifestyle" },
];

type PhotoCategory = "full_body" | "face" | "upper_body" | "lifestyle";

interface PhotoRecord {
  id: string;
  category: PhotoCategory;
  storage_path: string;
  signedUrl?: string;
}

export default function Profile() {
  const { user, signOut } = useAuth();
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

  const avatarUrl = user?.user_metadata?.avatar_url;
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || "User";
  const email = user?.email;

  return (
    <ExtensionLayout>
      <div className="flex h-full flex-col justify-between p-8">
        {/* Header — centered user info */}
        <div className="flex flex-col items-center pt-2 text-center">
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-secondary text-[15px] font-medium text-muted-foreground">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="mt-3 text-[15px] font-medium text-foreground">{displayName}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{email}</p>
        </div>

        {/* Middle — photo grid */}
        <div className="flex-1 py-6">
          <p className="text-center text-[12px] text-muted-foreground">Your photos for virtual try-on</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
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
                    <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background text-muted-foreground transition-colors hover:bg-secondary/50">
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cat.key, e.target.files[0])} />
                      {uploading === cat.key ? (
                        <span className="text-[12px]">Uploading…</span>
                      ) : (
                        <>
                          <span className="text-[18px] leading-none">+</span>
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

        {/* Footer — sign out */}
        <div className="pb-2 text-center">
          <button
            onClick={signOut}
            className="text-[11px] text-muted-foreground/60 transition-opacity hover:opacity-70"
          >
            Sign Out
          </button>
        </div>
      </div>
    </ExtensionLayout>
  );
}
