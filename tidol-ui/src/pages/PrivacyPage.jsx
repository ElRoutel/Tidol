import React from 'react';
import './terms.css';

export default function PrivacyPage() {
  return (
    <div className="terms-page">
      <div className="terms-container">
        <div className="terms-header glass-card">
          <h1 className="terms-title">Política de Privacidad</h1>
          <p className="terms-subtitle">Última actualización: Noviembre 2025</p>
        </div>

        <div className="terms-content">
          <section className="terms-section">
            <h2 className="section-title">1. Información que recopilamos</h2>
            <p>
              Recopilamos información que nos proporciona directamente cuando te registras, subes contenido o interactúas con la plataforma. 
              Esto puede incluir nombre de usuario, dirección de correo electrónico, metadatos de las canciones que subes y otra información de perfil.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="section-title">2. Cómo usamos tu información</h2>
            <p>
              Utilizamos la información para: proporcionar y mejorar el servicio, personalizar recomendaciones, enviar comunicaciones relacionadas con tu cuenta y para cumplir obligaciones legales.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="section-title">3. Compartir información</h2>
            <p>
              No vendemos tu información a terceros. Podemos compartir datos con proveedores de servicios que nos ayudan a operar la plataforma y, cuando sea necesario, con autoridades en cumplimiento de la ley.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="section-title">4. Seguridad</h2>
            <p>
              Implementamos medidas de seguridad técnicas y organizativas razonables para proteger la información. Sin embargo, ningún sistema es completamente seguro; por ello te recomendamos proteger tus credenciales.
            </p>
          </section>

          <section className="terms-section">
            <h2 className="section-title">5. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta Política de Privacidad, contáctanos en <strong>Elroutel@hotmail.com</strong> o abre un issue en nuestro repositorio.
            </p>
          </section>
        </div>
        {/* Disclaimer */}
          <section className="terms-section disclaimer">
            <h2 className="section-title">Proyecto open source</h2>
            <p>
              Tidol es un proyecto de código abierto y no está afiliado ni respaldado por Internet Archive. No alojamos contenido directamente sin la compra previa de este producto; simplemente facilitamos el acceso a grabaciones disponibles públicamente en Internet Archive.
            </p>
            <p>
              No somos responsables del contenido subido por los usuarios ni de la precisión o legalidad del mismo. Al usar Tidol, aceptas que no somos responsables de:
            </p>
            <ul className="terms-list">
              <li>El contenido disponible en Internet Archive o sus cambios</li>
              <li>Reclamos de copyright sobre contenido de terceros</li>
              <li>La legalidad del contenido subido por usuarios</li>
              <li>Pérdida de datos o acceso no autorizado a tu cuenta</li>
             <p><strong>PLATAFORMA DE CÓDIGO ABIERTO PARA EL PRIMERO DE ENERO DE 2026</strong></p>
            </ul>
            <p>
              PÁGINA EN DESARROLLO NO BUSCA FINES COMERCIALES, NO SE GARANTIZA LA DISPONIBILIDAD O FUNCIONALIDAD COMPLETA DE LA PLATAFORMA.
                ESTA PLATAFORMA NACE DE LA INCOFORMIDAD DE LAS MASAS NO BUSCA FINES POLITICOS NI COMERCIALES , LOS RESPONSABLES DE ESTE PROYECTO ASI COMO DE LOS QUE LO ALOJAN SON RESPONSABLES DE SU PRODUCCION
            </p>
          </section>
        <div className="terms-footer glass-card">
          <p>2025 Tidol.</p>
        </div>
      
      </div>
    </div>
  );
}
