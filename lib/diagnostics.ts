// Never return raw messages/details: upstream failures can contain credentials or PII.
export function safeBackendError(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as { code?: unknown; message?: unknown; status?: unknown })
      : {};
  const code =
    typeof value.code === "string" && /^[a-z0-9_]{1,48}$/i.test(value.code)
      ? value.code
      : "unknown";
  const status =
    typeof value.status === "number" && Number.isInteger(value.status)
      ? value.status
      : undefined;
  const message = typeof value.message === "string" ? value.message : "";
  const delay =
    status === 429 ? /after\s+(\d{1,5})\s+seconds/i.exec(message) : null;
  const retryAfterSeconds =
    delay && Number(delay[1]) > 0 && Number(delay[1]) <= 86400
      ? Number(delay[1])
      : undefined;
  const category = /invalid api key/i.test(message)
    ? "invalid_api_key"
    : /jwt|jws/i.test(message)
      ? "invalid_token"
      : /schema cache|does not exist/i.test(message)
        ? "missing_schema"
        : /permission denied/i.test(message)
          ? "permission_denied"
          : /fetch failed|timeout|network/i.test(message)
            ? "network"
            : "upstream";
  return { code, status, category, retryAfterSeconds };
}

export function recoveryFailure(error: unknown) {
  const diagnostic = safeBackendError(error);
  if (diagnostic.retryAfterSeconds) {
    return {
      status: 429,
      message: `Espera al menos ${diagnostic.retryAfterSeconds} segundos antes de solicitar otro correo de recuperación.`,
    };
  }
  if (diagnostic.code === "over_email_send_rate_limit") {
    return {
      status: 429,
      message:
        "Se alcanzó el límite temporal de envío de correos. Espera a que se restablezca antes de solicitar otro enlace.",
    };
  }
  if (
    diagnostic.status === 429 ||
    diagnostic.code === "over_request_rate_limit"
  ) {
    return {
      status: 429,
      message:
        "Hay demasiadas solicitudes de recuperación. Espera antes de volver a intentarlo.",
    };
  }
  return { status: 503, message: "El servicio de correo no está disponible." };
}
