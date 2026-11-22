import Image from "next/image";
import ViolenceResearch from "./violence-research";

export default function ViolenceImpact() {
  return (
    <>
      <Image
        className="violence-infographic"
        src="/recursos/infografia-impacto-violencia.jpeg"
        alt="Infografía sobre el impacto fisiológico y anatómico de la violencia. La respuesta inmediata puede incluir aumento del ritmo cardíaco, respiración rápida, sudoración, temblores y tensión muscular. La violencia puede causar lesiones externas e internas. La exposición prolongada puede afectar el sueño, la salud cardiovascular, la concentración y el estado de ánimo. Buscar apoyo profesional puede ayudar."
        width={807}
        height={1600}
        unoptimized
      />
      <ViolenceResearch />
    </>
  );
}
