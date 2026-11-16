import { z } from "zod";

const email = z
  .string()
  .trim()
  .max(200, "El correo es demasiado largo.")
  .pipe(z.email({ error: "Introduce un correo electrónico válido." }))
  .transform((value) => value.toLowerCase());

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, "Introduce tu contraseña.")
    .max(128, "La contraseña es demasiado larga."),
});

export const signupSchema = z.object({
  email,
  password: z
    .string()
    .min(12, "Usa una contraseña de al menos 12 caracteres.")
    .max(128, "La contraseña es demasiado larga."),
  name: z
    .string()
    .trim()
    .min(2, "Escribe un nombre o alias de al menos 2 caracteres.")
    .max(100, "El nombre o alias es demasiado largo."),
});
