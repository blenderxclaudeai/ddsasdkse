import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExtensionLayout } from "@/components/ExtensionLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export default function AdminPage() {
  const [merchants, setMerchants] = useState<any[]>([]);
  const [pendingEntries, setPendingEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"merchants" | "cashback">("merchants");
  const [newMerchant, setNewMerchant] = useState({ domain: "", network: "", affiliate_link_template: "", commission_rate: "" });

  const loadData = async () => {
    const [m, w] = await Promise.all([
      supabase.from("affiliate_merchants").select("*").order("created_at", { ascending: false }),
      supabase.from("wallet_ledger").select("*, profiles(display_name)").eq("status", "pending").order("created_at", { ascending: false }),
    ]);
    setMerchants(m.data ?? []);
    setPendingEntries(w.data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const addMerchant = async () => {
    if (!newMerchant.domain) return;
    const { error } = await supabase.from("affiliate_merchants").insert({
      domain: newMerchant.domain,
      network: newMerchant.network || null,
      affiliate_link_template: newMerchant.affiliate_link_template || null,
      commission_rate: newMerchant.commission_rate ? parseFloat(newMerchant.commission_rate) : null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Merchant added" });
      setNewMerchant({ domain: "", network: "", affiliate_link_template: "", commission_rate: "" });
      loadData();
    }
  };

  const deleteMerchant = async (id: string) => {
    await supabase.from("affiliate_merchants").delete().eq("id", id);
    toast({ title: "Deleted" });
    loadData();
  };

  const approveCashback = async (id: string) => {
    const { error } = await supabase.from("wallet_ledger").update({ status: "available" as any }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Approved" }); loadData(); }
  };

  return (
    <ExtensionLayout>
      <div className="p-6">
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Admin</h1>

        <div className="mt-4 flex gap-4 border-b border-border">
          <button
            onClick={() => setTab("merchants")}
            className={`pb-2 text-[13px] font-medium transition-all ${tab === "merchants" ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"}`}
          >
            Merchants
          </button>
          <button
            onClick={() => setTab("cashback")}
            className={`pb-2 text-[13px] font-medium transition-all ${tab === "cashback" ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"}`}
          >
            Cashback
          </button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-secondary" />)}
          </div>
        ) : tab === "merchants" ? (
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Input placeholder="Domain" value={newMerchant.domain} onChange={e => setNewMerchant(p => ({ ...p, domain: e.target.value }))} className="bg-secondary border-0 text-[13px]" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Network" value={newMerchant.network} onChange={e => setNewMerchant(p => ({ ...p, network: e.target.value }))} className="bg-secondary border-0 text-[13px]" />
                <Input placeholder="Commission %" type="number" step="0.01" value={newMerchant.commission_rate} onChange={e => setNewMerchant(p => ({ ...p, commission_rate: e.target.value }))} className="bg-secondary border-0 text-[13px]" />
              </div>
              <Input placeholder="Link template" value={newMerchant.affiliate_link_template} onChange={e => setNewMerchant(p => ({ ...p, affiliate_link_template: e.target.value }))} className="bg-secondary border-0 text-[13px]" />
              <Button onClick={addMerchant} className="w-full text-[13px]">Add Merchant</Button>
            </div>

            <div className="space-y-1">
              {merchants.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{m.domain}</p>
                    <p className="text-[11px] text-muted-foreground">{m.network || "—"} · {m.commission_rate ? `${m.commission_rate}%` : "—"}</p>
                  </div>
                  <button onClick={() => deleteMerchant(m.id)} className="text-[12px] text-destructive transition-opacity hover:opacity-70">Remove</button>
                </div>
              ))}
              {merchants.length === 0 && <p className="py-8 text-center text-[13px] text-muted-foreground">No merchants</p>}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {pendingEntries.map(e => (
              <div key={e.id} className="flex items-center justify-between rounded-xl bg-secondary px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-foreground">${Number(e.amount).toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">{(e as any).profiles?.display_name || "Unknown"}</p>
                </div>
                <button onClick={() => approveCashback(e.id)} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-80">Approve</button>
              </div>
            ))}
            {pendingEntries.length === 0 && <p className="py-8 text-center text-[13px] text-muted-foreground">No pending entries</p>}
          </div>
        )}
      </div>
    </ExtensionLayout>
  );
}
