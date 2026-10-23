// Busca de CEP a partir do endereço usando a API pública ViaCEP (sem chave).
export interface CepMatch {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Procura CEPs por UF + cidade + logradouro.
 * Retorna lista de correspondências (pode ser vazia). Lança erro em falha de rede.
 */
export async function lookupCepByAddress(uf: string, city: string, street: string): Promise<CepMatch[]> {
  const q = [uf, city, street].map(normalize).filter(Boolean);
  if (q.length < 3) return [];
  const url = `https://viacep.com.br/ws/${encodeURIComponent(q[0])}/${encodeURIComponent(q[1])}/${encodeURIComponent(q[2])}/json/`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .filter((d: any) => d?.cep)
      .map((d: any) => ({
        cep: String(d.cep).replace(/\D/g, ''),
        logradouro: d.logradouro ?? '',
        bairro: d.bairro ?? '',
        localidade: d.localidade ?? '',
        uf: d.uf ?? '',
      }));
  } finally {
    clearTimeout(timeout);
  }
}
