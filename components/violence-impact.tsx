import { Activity, Bone, Brain, HeartHandshake } from "lucide-react";
import Link from "next/link";
import ViolenceResearch from "./violence-research";

export default function ViolenceImpact() {
  return (
    <>
      <figure
        className="violence-infographic"
        aria-labelledby="impacto-violencia"
      >
        <figcaption>
          <p>Infografía</p>
          <h2 id="impacto-violencia">
            Impacto de la violencia en el cuerpo y la salud
          </h2>
        </figcaption>
        <article className="violence-infographic-card">
          <span className="violence-infographic-icon" aria-hidden="true">
            <Activity size={38} />
          </span>
          <div>
            <h3>Respuesta fisiológica inmediata</h3>
            <p>
              Ante el peligro, el cuerpo activa su sistema de alarma y libera
              hormonas del estrés. Se prepara para luchar, huir o quedarse
              inmóvil.
            </p>
            <ul>
              <li>Aumento del ritmo cardíaco.</li>
              <li>Respiración rápida y superficial.</li>
              <li>Sudoración y temblores.</li>
              <li>Tensión muscular.</li>
            </ul>
          </div>
        </article>
        <article className="violence-infographic-card">
          <span className="violence-infographic-icon" aria-hidden="true">
            <Bone size={38} />
          </span>
          <div>
            <h3>Impacto anatómico</h3>
            <p>La violencia puede causar lesiones dentro y fuera del cuerpo.</p>
            <ul>
              <li>
                <strong>Cabeza y rostro.</strong> Contusiones, cortes y
                traumatismos craneoencefálicos.
              </li>
              <li>
                <strong>Piel.</strong> Moretones, rasguños, quemaduras y
                lesiones por estrangulamiento.
              </li>
              <li>
                <strong>Músculos.</strong> Contracturas, dolor crónico y
                desgarros.
              </li>
              <li>
                <strong>Huesos.</strong> Fracturas, fisuras y luxaciones.
              </li>
              <li>
                <strong>Órganos internos.</strong> Lesiones en el pecho o el
                abdomen.
              </li>
              <li>
                <strong>Salud sexual y reproductiva.</strong> La violencia
                sexual puede causar lesiones, infecciones de transmisión sexual
                y embarazos no deseados.
              </li>
            </ul>
          </div>
        </article>
        <article className="violence-infographic-card">
          <span className="violence-infographic-icon" aria-hidden="true">
            <Brain size={38} />
          </span>
          <div>
            <h3>Efectos a mediano y largo plazo</h3>
            <p>
              La exposición prolongada a la violencia y el estrés persistente
              pueden afectar la salud física y mental.
            </p>
            <ul>
              <li>Problemas de sueño, fatiga y falta de energía.</li>
              <li>Dolores crónicos y problemas musculares o digestivos.</li>
              <li>
                Mayor riesgo de hipertensión y enfermedades cardiovasculares.
              </li>
              <li>
                Ansiedad, depresión, baja autoestima y dificultades para
                concentrarse.
              </li>
            </ul>
          </div>
        </article>
        <div className="violence-infographic-support">
          <HeartHandshake size={28} aria-hidden="true" />
          <div>
            <strong>Cada experiencia es distinta.</strong>
            <p>
              Hablar con alguien de confianza o buscar apoyo profesional puede
              ayudar.
            </p>
            <Link className="text-link" href="/ayuda">
              Encontrar ayuda
            </Link>
          </div>
        </div>
      </figure>
      <ViolenceResearch />
    </>
  );
}
