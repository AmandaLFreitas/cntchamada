import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo-cnt.png";

// The `auth.oauth` namespace is beta and not in the generated types yet.
// Local typed wrapper for the three methods we call.
type OAuthResult = {
  data?: {
    client?: { name?: string; redirect_uris?: string[] };
    scope?: string;
    redirect_url?: string;
    redirect_to?: string;
  } | null;
  error?: { message: string } | null;
};
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthResult["data"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/?next=" + encodeURIComponent(next);
        return;
      }
      setAccount(sess.session.user.email ?? sess.session.user.id);
      const res = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (res.error) {
        setError(res.error.message);
        return;
      }
      const immediate = res.data?.redirect_url ?? res.data?.redirect_to;
      if (immediate && !res.data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(res.data ?? null);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const res = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (res.error) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    const target = res.data?.redirect_url ?? res.data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Nenhum redirecionamento retornado pelo servidor de autorização.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border rounded-xl p-8 shadow-lg">
        <div className="text-center mb-6">
          <img
            src={logoImg}
            alt="CNT Informática"
            className="w-16 h-16 rounded-full mx-auto mb-2 object-cover"
          />
          <h1 className="text-xl font-bold">Conectar aplicativo</h1>
        </div>

        {error && (
          <div className="text-sm text-destructive text-center py-6">
            Não foi possível carregar esta solicitação: {error}
          </div>
        )}

        {!error && !details && (
          <p className="text-center text-muted-foreground py-6">Carregando…</p>
        )}

        {!error && details && (
          <div className="space-y-4">
            <p className="text-sm">
              <span className="font-semibold">{details.client?.name ?? "Um aplicativo"}</span>{" "}
              quer se conectar à sua conta{" "}
              <span className="font-medium">{account}</span> no CNT Informática.
            </p>
            <div className="text-sm bg-muted/50 rounded-md p-3 space-y-1">
              <p>
                O aplicativo poderá utilizar as ferramentas do sistema em seu nome,
                respeitando suas permissões (unidade, papel) — nunca acessa dados
                fora do que você já pode ver.
              </p>
              <p className="text-muted-foreground">
                Isso não substitui as políticas do sistema; toda ação continua
                sujeita às regras de acesso do banco de dados.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => decide(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => decide(true)}
              >
                {busy ? "Aguarde…" : "Autorizar"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
