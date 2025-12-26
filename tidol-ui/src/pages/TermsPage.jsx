import React from 'react';
import { Link } from 'react-router-dom';
import './terms.css';

export default function TermsPage() {
  return (
    <div className="terms-page">
      <div className="terms-container">
        {/* Header */}
        <div className="terms-header glass-card">
          <h1 className="terms-title">Términos de Uso</h1>
          <p className="terms-subtitle">Última actualización: Noviembre 2025</p>
        </div>

        {/* Contenido */}
        <div className="terms-content">
          {/* 1. Introducción */}
          <section className="terms-section">
            <h2 className="section-title">1. Introducción</h2>
            <p>
              Bienvenido a <strong>Tidol</strong>, una plataforma de streaming de música que integra tu biblioteca personal con contenido de Internet Archive. 
              Al acceder y utilizar Tidol, aceptas estar vinculado por estos Términos de Uso. Si no estás de acuerdo con alguno de estos términos, 
              por favor no utilices nuestro servicio.
            </p>
          </section>

          {/* 2. Descripción del Servicio */}
          <section className="terms-section">
            <h2 className="section-title">2. Descripción del Servicio</h2>
            <p>
              Tidol es una aplicación web que te permite:
            </p>
            <ul className="terms-list">
              <li>Reproducir música de tu biblioteca personal</li>
              <li>Crear y gestionar playlists</li>
              <li>Buscar y reproducir contenido de Internet Archive</li>
              <li>Guardar canciones como favoritas</li>
              <li>Subir tu propia música a la plataforma</li>
              <li>Acceder a recomendaciones personalizadas</li>
            </ul>
          </section>

          {/* 3. Requisitos de Uso */}
          <section className="terms-section">
            <h2 className="section-title">3. Requisitos de Uso</h2>
            <p>
              Para usar Tidol, debes:
            </p>
            <ul className="terms-list">
              <li>Ser mayor de 13 años (o tener consentimiento parental si eres menor)</li>
              <li>Crear una cuenta válida con información exacta</li>
              <li>Responsabilizarte de mantener la confidencialidad de tu contraseña</li>
              <li>No compartir tu cuenta con otras personas</li>
              <li>Cumplir con todas las leyes y regulaciones aplicables</li>
            </ul>
          </section>

          {/* 4. Propiedad Intelectual */}
          <section className="terms-section">
            <h2 className="section-title">4. Propiedad Intelectual</h2>
            <div className="subsection">
              <h3>4.1 Contenido de Internet Archive</h3>
              <p>
                El contenido accesible a través de Internet Archive está sujeto a los términos de licencia de Internet Archive. 
                Tidol no posee ni controla este contenido. Solo actúa como intermediario para facilitar el acceso.
              </p>
            </div>
            <div className="subsection">
              <h3>4.2 Contenido Subido por Usuarios</h3>
              <p>
                Cuando subes música a Tidol, garantizas que posees los derechos necesarios o tienes permiso para distribuir ese contenido. 
                Al subir contenido, otorgas a Tidol una licencia para almacenar, reproducir y distribuir ese contenido dentro de la plataforma.
              </p>
            </div>
            <div className="subsection">
              <h3>4.3 Marca y Derechos de Autor de Tidol</h3>
              <p>
                Tidol, su logotipo, diseño y funcionalidades son propiedad de nuestro equipo de desarrollo. 
                No puedes reproducir, modificar o distribuir estos elementos sin permiso explícito.
              </p>
            </div>
          </section>

          {/* 5. Prohibiciones */}
          <section className="terms-section">
            <h2 className="section-title">5. Prohibiciones</h2>
            <p>
              No debes usar Tidol para:
            </p>
            <ul className="terms-list">
              <li>Subir contenido que infrinja derechos de autor o propiedad intelectual de terceros</li>
              <li>Acceder de forma no autorizada al sistema o intentar eludirlo</li>
              <li>Distribuir malware, virus o código malicioso</li>
              <li>Acosar, amenazar o humiliar a otros usuarios</li>
              <li>Usar la plataforma con fines comerciales no autorizados</li>
              <li>Realizar scraping o descargar contenido masivamente sin autorización</li>
              <li>Violar cualquier ley o regulación local, estatal o internacional</li>
            </ul>
          </section>

          {/* 6. Responsabilidad de Contenido */}
          <section className="terms-section">
            <h2 className="section-title">6. Responsabilidad de Contenido</h2>
            <p>
              <strong>Eres responsable</strong> de todo el contenido que subes a Tidol. Nosotros no verificamos ni controlamos la legalidad 
              de ese contenido. Si alguien reclama que tu contenido infringe sus derechos, podemos remover ese contenido sin previo aviso.
            </p>
            <p>
              El contenido de Internet Archive está proporcionado "tal cual" sin garantías. Tidol no es responsable de su precisión, 
              legalidad o adecuación.
            </p>
          </section>

          {/* 7. Limitación de Responsabilidad */}
          <section className="terms-section">
            <h2 className="section-title">7. Limitación de Responsabilidad</h2>
            <p>
              <strong>Tidol se proporciona "tal cual" sin garantías de ningún tipo.</strong> No somos responsables por:
            </p>
            <ul className="terms-list">
              <li>Pérdida de datos o interrupciones del servicio</li>
              <li>Errores, bugs o funcionamiento incorrecto</li>
              <li>Daños indirectos, incidentales o consequentes</li>
              <li>Pérdida de ingresos o datos comerciales</li>
            </ul>
            <p>
              Nuestra responsabilidad máxima ante ti está limitada al monto que hayas pagado por usar Tidol (si aplica).
            </p>
          </section>

          {/* 8. Privacidad */}
          <section className="terms-section">
            <h2 className="section-title">8. Privacidad</h2>
            <p>
              Tu uso de Tidol también está sujeto a nuestra Política de Privacidad. Por favor revísala para entender nuestras prácticas 
              de recopilación y uso de datos.
            </p>
          </section>

          {/* 9. Cambios en el Servicio */}
          <section className="terms-section">
            <h2 className="section-title">9. Cambios en el Servicio</h2>
            <p>
              Nos reservamos el derecho a:
            </p>
            <ul className="terms-list">
              <li>Modificar, suspender o discontinuar Tidol en cualquier momento</li>
              <li>Cambiar estas Términos de Uso con notificación previa</li>
              <li>Limitar o desactivar características sin responsabilidad</li>
            </ul>
            <p>
              Si continuás usando Tidol después de cambios notificados, aceptas esos cambios.
            </p>
          </section>

          {/* 10. Rescisión */}
          <section className="terms-section">
            <h2 className="section-title">10. Rescisión</h2>
            <p>
              Podemos suspender o terminar tu acceso a Tidol en cualquier momento, con o sin causa, sin responsabilidad. 
              Esto incluye violaciones de estos términos, actividad ilegal, o por cualquier otra razón a nuestra discreción.
            </p>
          </section>

          {/* 11. Ley Aplicable */}
          <section className="terms-section">
            <h2 className="section-title">11. Ley Aplicable</h2>
            <p>
              Estos Términos de Uso se rigen por las leyes vigentes en el país de origen del servicio. 
              Cualquier disputa será resuelta en los tribunales competentes de esa jurisdicción.
            </p>
          </section>

          {/* 12. Contacto */}
          <section className="terms-section">
            <h2 className="section-title">12. Contacto</h2>
            <p>
              Si tienes preguntas sobre estos Términos de Uso, por favor contáctanos a través de:
            </p>
            <ul className="terms-list">
              <li>Email: ElRoutel@hotmail.com</li>
              <li>GitHub: <a href="https://github.com/ElRoutel/Tidol" target="_blank" rel="noopener noreferrer">github.com/ElRoutel/Tidol</a></li>
            </ul>
          </section>
        <section className="terms-section">
            <h2 className="section-title">Recomendaciones al usuario final</h2>
            <p>
              Estos Términos de Uso constituyen el acuerdo completo entre tú y Tidol. Para proteger tu privacidad te recomendamos evitar el uso de correos personales o tu nombre real al registrarte o utilizar la aplicación; considera una dirección de contacto separada o un alias cuando sea apropiado.
            </p>
            <p>
              Tidol realiza monitoreo básico del uso de la plataforma en búsqueda de actividades que puedan indicar piratería o abuso del servicio. El uso indebido de la aplicación por parte de usuarios puede exponer tanto al usuario como a Tidol a reclamaciones legales o acciones administrativas. En casos de indicios razonables de infracción, Tidol se reserva el derecho de suspender o cancelar cuentas y de cooperar con las autoridades competentes cuando la ley lo requiera.
            </p>
            <p>
              No podemos incluir ni promover recomendaciones para evadir sanciones legales o eludir controles (por ejemplo, instrucciones para ocultar actividad ilícita). Si te preocupa tu privacidad, sigue prácticas legales y responsables: revisa nuestra Política de Privacidad, limita la información personal que compartes, utiliza direcciones de contacto alternativas y consulta asesoría legal si tienes dudas sobre el uso de contenido disponible en la plataforma.
            </p>
        </section>
          {/* Disclaimer */}
          <section className="terms-section disclaimer">
            <h2 className="section-title">Descargo de Responsabilidad</h2>
            <p>
              Tidol actúa como agregador de contenido. No somos responsables por:
            </p>
            <ul className="terms-list">
              <li>El contenido disponible en Internet Archive o sus cambios</li>
              <li>Reclamos de copyright sobre contenido de terceros</li>
              <li>La legalidad del contenido subido por usuarios</li>
              <li>Pérdida de datos o acceso no autorizado a tu cuenta</li>
            </ul>
            <p>
              Usas Tidol bajo tu propio riesgo. Siempre verifica que tienes los derechos necesarios para usar el contenido que reproduces o subes.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="terms-footer glass-card">
          <p> 2025 Tidol.</p>
          <p className="footer-note">Al usar Tidol, aceptas estos Términos de Uso (SOBRETODO A QUIEN LO ALOJA).</p>
          <Link to="/privacy" className="auth-terms-link">Política de Privacidad</Link>
        </div>
      </div>
    </div>
  );
}
