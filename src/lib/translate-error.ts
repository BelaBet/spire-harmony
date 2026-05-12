// Traduz mensagens comuns de erro (Supabase Auth/PostgREST) para PT-BR.
const MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "E-mail ou senha incorretos."],
  [/email not confirmed/i, "Confirme seu e-mail antes de entrar."],
  [/user already registered/i, "Este e-mail já está cadastrado."],
  [/user not found/i, "Usuário não encontrado."],
  [/password should be at least (\d+)/i, "A senha deve ter no mínimo $1 caracteres."],
  [/new password should be different/i, "A nova senha deve ser diferente da anterior."],
  [/signup.*disabled/i, "Cadastro desativado no momento."],
  [/email rate limit exceeded/i, "Muitas tentativas. Aguarde alguns minutos."],
  [/over.*request rate limit/i, "Muitas tentativas. Tente novamente em instantes."],
  [/jwt expired/i, "Sessão expirada. Entre novamente."],
  [/invalid.*token/i, "Token inválido ou expirado."],
  [/network.*error|failed to fetch/i, "Falha de conexão. Verifique sua internet."],
  [/permission denied|not authorized|rls/i, "Você não tem permissão para esta ação."],
  [/duplicate key value/i, "Registro duplicado."],
  [/violates foreign key/i, "Operação inválida: existem dados relacionados."],
  [/violates not-null/i, "Preencha todos os campos obrigatórios."],
  [/value too long/i, "Algum campo excedeu o tamanho máximo."],
  [/invalid input syntax/i, "Formato de dado inválido."],
];

export function translateError(err: unknown): string {
  const msg =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message ?? "")
        : "";
  if (!msg) return "Algo deu errado. Tente novamente.";
  for (const [re, pt] of MAP) {
    if (re.test(msg)) return msg.replace(re, pt);
  }
  return msg;
}
