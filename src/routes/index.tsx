import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recruta Zap — Envio em massa no WhatsApp Web" },
      { name: "description", content: "Extensão para RH enviar mensagens personalizadas em massa no WhatsApp Web." },
      { property: "og:title", content: "Recruta Zap — Envio em massa no WhatsApp Web" },
      { property: "og:description", content: "Cole números e nomes da planilha e envie mensagens personalizadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function download() {
  fetch("/recruta-zap.zip")
    .then((r) => {
      if (!r.ok) throw new Error("Falha no download");
      return r.blob();
    })
    .then((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "recruta-zap.zip";
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch((e) => alert(e.message));
}

function Index() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-xl">
        <h1 className="text-4xl font-bold text-foreground">Recruta Zap</h1>
        <p className="mt-3 text-muted-foreground">
          Extensão para o WhatsApp Web: cole números e nomes da planilha, escreva a mensagem com {"{nome}"} ou{" "}
          {"{primeiro_nome}"} e envie para todos automaticamente.
        </p>
        <button
          onClick={download}
          className="mt-8 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90"
        >
          Baixar extensão
        </button>
        <h2 className="mt-12 text-xl font-semibold text-foreground">Como instalar</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Descompacte o arquivo baixado.</li>
          <li>Abra chrome://extensions no Chrome.</li>
          <li>Ative o "Modo do desenvolvedor" (canto superior direito).</li>
          <li>Clique em "Carregar sem compactação" e escolha a pasta descompactada.</li>
          <li>Abra o WhatsApp Web e clique no botão verde "Envio em massa".</li>
        </ol>
        <h2 className="mt-10 text-xl font-semibold text-foreground">Dicas</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>Copie as colunas Número e Nome da planilha e cole direto (qualquer ordem).</li>
          <li>Números sem 55 recebem o código do Brasil automaticamente.</li>
          <li>Use intervalos de 15–30s ou mais para reduzir o risco de bloqueio.</li>
        </ul>
      </div>
    </main>
  );
}
