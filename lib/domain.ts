import { z } from "zod";
export const categories = [
  "Psicológica",
  "Física",
  "Sexual",
  "Económica",
  "Digital",
  "Discriminación",
] as const;
export const statuses = [
  "Recibido",
  "En revisión",
  "En atención",
  "Canalizado",
  "Cerrado",
] as const;
export const reportSchema = z
  .object({
    reporter: z.enum(["affected", "witness", "student"]),
    categories: z.array(z.enum(categories)).min(1).max(6),
    description: z
      .string()
      .trim()
      .min(30, "Cuéntanos un poco más: al menos 30 caracteres.")
      .max(8000),
    location: z.string().trim().max(300),
    occurred_at: z
      .string()
      .max(10)
      .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha no válida"),
    recurring: z.boolean(),
    witnesses: z.boolean(),
    school: z.string().trim().max(200),
    anonymous: z.boolean(),
    name: z.string().trim().max(120),
    email: z.union([z.literal(""), z.email()]),
    phone: z.string().trim().max(30),
    contact_consent: z.boolean(),
    notification_consent: z.boolean(),
    privacy_consent: z.literal(true, {
      error: "Necesitas leer y aceptar el aviso de privacidad.",
    }),
    demo_ack: z.boolean(),
  })
  .superRefine((v, c) => {
    if (
      v.anonymous &&
      (v.name ||
        v.email ||
        v.phone ||
        v.contact_consent ||
        v.notification_consent)
    )
      c.addIssue({
        code: "custom",
        message: "El reporte anónimo no debe incluir datos de contacto.",
      });
    if (!v.anonymous && (v.email || v.phone) && !v.contact_consent)
      c.addIssue({
        code: "custom",
        message: "Autoriza el contacto o retira tus datos de contacto.",
      });
    if (v.notification_consent && !v.contact_consent)
      c.addIssue({
        code: "custom",
        message: "Las notificaciones requieren autorización de contacto.",
      });
  });
export type ReportInput = z.infer<typeof reportSchema>;
export type Report = {
  id: string;
  folio: string;
  owner_id: string | null;
  reporter: string;
  categories: string[];
  description: string;
  location: string;
  occurred_at: string;
  recurring: boolean;
  witnesses: boolean;
  school: string;
  anonymous: boolean;
  status: string;
  priority: string;
  assignee_id: string | null;
  token_hash: string;
  created_at: string;
  updated_at: string;
};
export type Profile = {
  id: string;
  email: string;
  name: string;
  role: "user" | "staff" | "admin";
  password_hash?: string;
  created_at: string;
};
export type Contact = {
  id: string;
  report_id: string;
  name: string;
  email: string;
  phone: string;
  contact_consent: boolean;
  notification_consent: boolean;
};
export type Update = {
  id: string;
  report_id: string;
  author_id: string | null;
  body: string;
  kind: "public" | "internal" | "reporter";
  created_at: string;
};
export type Evidence = {
  id: string;
  report_id: string;
  filename: string;
  mime: string;
  size: number;
  path: string;
  created_at: string;
};
export type Resource = {
  id: string;
  name: string;
  description: string;
  phone: string;
  url: string;
  region: string;
  kind: string;
  verified_at: string | null;
  published: boolean;
};
export type Tables = {
  reports: Report;
  profiles: Profile;
  contacts: Contact;
  updates: Update;
  evidence: Evidence;
  resources: Resource;
  audit: {
    id: string;
    actor_id: string;
    report_id: string | null;
    action: string;
    created_at: string;
  };
  feedback: {
    id: string;
    report_id: string;
    rating: number;
    comment: string;
    created_at: string;
  };
};
export const education = [
  {
    name: "Psicológica",
    icon: "heart",
    text: "Insultos, humillaciones, amenazas, aislamiento o control que afectan tu bienestar emocional.",
    signs: "Que te hagan sentir miedo, culpa o que no puedes decidir por ti.",
    action:
      "Busca un espacio seguro y habla con alguien de confianza. No necesitas esperar a que haya golpes para pedir ayuda.",
  },
  {
    name: "Física",
    icon: "shield",
    text: "Golpes, empujones, quemaduras u otras acciones que dañan tu cuerpo.",
    signs: "Lesiones, dolor o miedo a que vuelvan a lastimarte.",
    action:
      "Si hay peligro inmediato, llama al 911 en México. Busca atención médica cuando sea necesario.",
  },
  {
    name: "Sexual",
    icon: "hand",
    text: "Cualquier acto o contacto sexual sin consentimiento, incluido el acoso y la difusión de contenido íntimo.",
    signs:
      "Presión, amenazas o contacto que no deseas. El silencio no es consentimiento.",
    action:
      "No es tu culpa. Puedes buscar atención médica y acompañamiento especializado sin narrar todos los detalles aquí.",
  },
  {
    name: "Económica",
    icon: "wallet",
    text: "Controlar tu dinero, impedirte trabajar o estudiar, o retener recursos y documentos para limitarte.",
    signs:
      "Tener que pedir permiso para necesidades básicas o que te quiten tus ingresos.",
    action:
      "Busca orientación especializada y una red de apoyo. Evita acciones que puedan aumentar tu riesgo.",
  },
  {
    name: "Digital",
    icon: "phone",
    text: "Acoso por mensajes, vigilancia de cuentas, amenazas en redes o publicación de información sin permiso.",
    signs:
      "Exigencia de contraseñas, mensajes intimidatorios o rastreo de tu ubicación.",
    action:
      "Desde un dispositivo seguro, revisa tus accesos y busca acompañamiento. Conserva evidencias solo si hacerlo es seguro.",
  },
  {
    name: "Discriminación",
    icon: "users",
    text: "Trato desigual, exclusión o agresiones por identidad, origen, discapacidad, orientación u otras características.",
    signs:
      "Burlas, restricciones o exclusión reiterada en la escuela, trabajo u otros espacios.",
    action:
      "Puedes reportar lo ocurrido y buscar orientación. No tienes que enfrentar la situación sin apoyo.",
  },
];
export const starterResources: Resource[] = [
  {
    id: "911",
    name: "Emergencias en México",
    description:
      "Si existe peligro inmediato o necesitas una ambulancia, llama al número nacional de emergencias.",
    phone: "911",
    url: "https://www.gob.mx/911",
    region: "Nacional",
    kind: "Emergencias",
    verified_at: null,
    published: true,
  },
  {
    id: "directorio",
    name: "Centros de Justicia para las Mujeres",
    description:
      "Consulta el directorio oficial para localizar atención jurídica, psicológica y social. Confirma disponibilidad directamente con el centro.",
    phone: "",
    url: "https://www.gob.mx/conavim",
    region: "México",
    kind: "Orientación",
    verified_at: null,
    published: true,
  },
  {
    id: "edomex",
    name: "Secretaría de las Mujeres · Estado de México",
    description:
      "Información institucional sobre servicios de orientación y apoyo en el Estado de México.",
    phone: "",
    url: "https://semujeres.edomex.gob.mx/",
    region: "Estado de México",
    kind: "Orientación",
    verified_at: null,
    published: true,
  },
];
