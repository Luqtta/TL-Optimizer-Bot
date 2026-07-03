// Validação de variáveis de ambiente no boot.
// Falha rápido (exit) se faltar algo essencial, e avisa sobre o que está
// faltando para cada funcionalidade — evita o bot subir e quebrar no meio
// de uma operação por causa de uma env ausente.

// Sem estas, o bot não funciona de forma alguma.
const REQUIRED = ["DISCORD_TOKEN"];

// Funcionalidades específicas dependem destas. Faltando, só a feature
// correspondente fica desativada — então avisamos em vez de derrubar.
const RECOMMENDED: Record<string, string> = {
  AUTO_ROLE_ID: "cargo automático ao entrar no servidor",
  WELCOME_CHANNEL_ID: "canal de boas-vindas",
  ROLE_MONTHLY_ID: "cargo do plano mensal",
  ROLE_YEARLY_ID: "cargo do plano anual",
  ROLE_LIFETIME_ID: "cargo do plano vitalício",
  LS_WEBHOOK_SECRET: "validação do webhook do TL Optimizer",
  GITHUB_WEBHOOK_SECRET: "validação do webhook do GitHub",
  FEATURE_CHANNEL_ID: "canal de releases/atualizações",
  DISCORD_SYNC_LOG_CHANNEL_ID: "canal de logs de sincronização",
  SHARE_CATEGORY_ID: "categoria/canal de divulgação (libera convites de Discord)",
  LS_API_URL: "API do TL Optimizer (vínculo e reconciliação)",
  DISCORD_BOT_API_KEY: "autenticação na API do TL Optimizer"
};

export function validateEnv(): void {
  const missingRequired = REQUIRED.filter((key) => !process.env[key]);

  if (missingRequired.length > 0) {
    console.error(
      `[ENV] Variáveis OBRIGATÓRIAS ausentes: ${missingRequired.join(", ")}`
    );
    console.error("[ENV] O bot não pode iniciar sem elas. Encerrando.");
    process.exit(1);
  }

  const missingRecommended = Object.keys(RECOMMENDED).filter(
    (key) => !process.env[key]
  );

  if (missingRecommended.length > 0) {
    console.warn(
      "[ENV] Variáveis recomendadas ausentes (a funcionalidade ligada a cada uma ficará desativada):"
    );
    for (const key of missingRecommended) {
      console.warn(`  - ${key}: ${RECOMMENDED[key]}`);
    }
  } else {
    console.log("[ENV] Todas as variáveis recomendadas estão configuradas.");
  }
}
