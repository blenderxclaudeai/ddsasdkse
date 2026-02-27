import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Upload, Trash2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const CATEGORIES = [
  { key: "full_body" as const, label: "Full Body", desc: "A full-length photo of yourself" },
  { key: "face" as const, label: "Face", desc: "A clear photo of your face" },
  { key: "hair" as const, label: "Hair", desc: "A photo showing your hairstyle" },
  { key: "hands_wrist" as const, label: "Hands & Wrist", desc: "A photo of your hands/wrists" },
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

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure? This will permanently delete all your data.")) return;
    // Delete all user data
    if (!user) return;
    await supabase.from("wallet_ledger").delete().eq("user_id", user.id);
    await supabase.from("click_events").delete().eq("user_id", user.id);
    await supabase.from("tryon_requests").delete().eq("user_id", user.id);
    for (const p of photos) {
      await supabase.storage.from("profile-photos").remove([p.storage_path]);
    }
    await supabase.from("profile_photos").delete().eq("user_id", user.id);
    await supabase.from("profiles").delete().eq("user_id", user.id);
    await supabase.auth.signOut();
    toast({ title: "Account data deleted" });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile Photos</h1>
          <p className="text-muted-foreground">Upload photos for virtual try-on</p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">{CATEGORIES.map(c => <Skeleton key={c.key} className="h-48" />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {CATEGORIES.map(cat => {
              const photo = photos.find(p => p.category === cat.key);
              return (
                <Card key={cat.key}>
                  <CardHeader>
                    <CardTitle className="text-base">{cat.label}</CardTitle>
                    <CardDescription>{cat.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {photo?.signedUrl ? (
                      <div className="space-y-2">
                        <img src={photo.signedUrl} alt={cat.label} className="h-40 w-full rounded-md object-cover" />
                        <div className="flex gap-2">
                          <label className="flex-1">
                            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cat.key, e.target.files[0])} />
                            <Button variant="outline" size="sm" className="w-full" asChild><span><Upload className="mr-1 h-3.5 w-3.5" />Replace</span></Button>
                          </label>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(photo)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    ) : (
                      <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary">
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cat.key, e.target.files[0])} />
                        {uploading === cat.key ? "Uploading…" : <><Upload className="mb-1 h-5 w-5" />Upload {cat.label}</>}
                      </label>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">This will permanently delete all your data including photos, try-on history, and wallet entries.</p>
            <Button variant="destructive" onClick={handleDeleteAccount}>Delete My Data</Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
