const firebaseConfig = {
  apiKey: "AIzaSyBsJ195IHwXovSseovxDhn0edoRETpUSWM",
  authDomain: "check-list-9e21f.firebaseapp.com",
  projectId: "check-list-9e21f",
  storageBucket: "check-list-9e21f.firebasestorage.app",
  messagingSenderId: "400755737958",
  appId: "1:400755737958:web:56b2404d349e2b917534a7",
  /**
   * Si en la consola de Firebase abres otra base de datos (no la predeterminada),
   * pon aquí su ID. Vacío = base "(default)".
   * Hoy la página usa la base «default» del SDK compat; si tus datos están en otra base,
   * hay que migrar el script al SDK modular (getFirestore(app, id)).
   */
  firestoreDatabaseId: "",
  /**
   * Respaldo opcional si falla el listado en raíz o REST (la UI ya no muestra sedes solo por esta lista).
   * index.html y estacionamientos.html sincronizan en tiempo real desde planillado + sedes + operators.
   */
  planilladoParkingIdsFallback: [
    "E-110 Amazon",
    "E-156 North Point",
    "E-2 Galerias 3 niveles",
    "E-26 Fonade",
    /** Una sola sede E-3: registros bajo planillado/E-3 Oporto/LugJR112/… */
    "E-3 Oporto",
    "E-5 Falabella",
    "E-90 TORRE 90",
    "E-95 Calle 95",
    /**
     * Ej. consola: …/planillado/E-56 Bog Americas/LugMC421/BOG-123
     * El ID lleva espacios y mayúsculas exactas como en Firestore.
     */
    "E-56 Bog Americas",
    /** Ej. …/planillado/E-50 FUNDONAL/LugMC421/TUY-567 */
    "E-50 FUNDONAL"
  ],
  /**
   * Nombres de subcolección de operario (Lug… / Pes…): la web escucha collectionGroup de cada uno.
   * index.html también lee automáticamente los IDs de la colección operators y sedes.
   * Si la app usa un código nuevo que no esté en operators, añádelo aquí.
   */
  planilladoDefaultSubcollectionsForAllParkings: [
    "registros",
    "LugJR112",
    "LugLJ141",
    "LugMC421",
    "LugLJ142",
    "LugLJ143",
    "LugMC422",
    "LugMC423"
  ],
  /**
   * Por ID exacto de sede: subcolecciones solo de esa sede (se suman a las de arriba).
   * Ejemplo si Amazon usa otro operario que Fonade:
   * "E-110 Amazon": ["LugXYZ01"],
   */
  /** Solo si hace falta acotar una sede (opcional; «LugJR112» ya está en default). */
  planilladoParkingOperarios: {
    "E-3 Oporto": ["registros", "LugJR112"]
  },
  /** Opcional: mapa legacy; preferir planilladoParkingOperarios. */
  planilladoParkingSubcollectionsFallback: {},
  /**
   * Opcional (planillados): correo sugerido al pulsar «Correo».
   * Vacío = el cliente de correo abre sin destinatario fijo.
   */
  planilladoReportEmailTo: "",
  /**
   * Opcional (planillados): clave de Google AI Studio (Gemini) para titular las fotos con visión.
   * Restrinja la clave por referrer/dominio en Google AI Studio; expone la clave en el cliente.
   * Vacío = solo se muestra la observación (description) sin texto generado por IA.
   */
  planilladoGeminiApiKey: "",
  /** Modelo Gemini con visión (planillados). Ej.: gemini-2.0-flash, gemini-1.5-flash */
  planilladoGeminiModel: "gemini-2.0-flash",
  /**
   * Mensualidades / contratos (mensualidades.html, caja POS, app móvil).
   * Ruta: mensualidades/{idSede}/residentes/{placa_normalizada}
   * Ej.: mensualidades/E-5 Falabella/residentes/UBG45Y
   * App móvil (check-list): nombreUsuario, montoFormateado, estacionamiento,
   * fechaFinMensualidad / fechaInicioMensualidad (DD/MM/YYYY), placaVehiculo, tipoVehiculo, etc.
   */
  mensualidadesCollection: "mensualidades",
  mensualidadesSubcollection: "residentes",
  /** Programación de personal semanal (programacion.html). Documento por lunes ISO: YYYY-MM-DD. */
  programacionSemanalCollection: "programacion_semanal",
  /**
   * Vista calendario para app móvil (se genera al guardar desde programacion.html).
   * Un documento por día: programacion_dias/YYYY-MM-DD con lista eventos del día.
   */
  programacionDiasCollection: "programacion_dias",
  /**
   * Catálogo de sedes / estacionamientos (estacionamientos.html).
   * Documento: sedes/{idSede} — id debe coincidir con planillado/cierres cuando aplique (ej. E-110 Amazon).
   */
  sedesCollection: "sedes",
  /**
   * Vehículos en lote del POS (estacionamientos.html · Lotes y capacidad).
   * Ruta: POS/{idSede}/{subcolección operario}/{idDocumento placa}
   * Campos típicos: placa, fechaEntrada, numeroTiquete, activa, estadoCaja, sede, origen.
   * Cupo por sede (sedes/{idSede}): cuposLote (número legacy), limitarLote (bool),
   * usarGruposLote (bool), motosPorCupoAuto (número, default 5),
   * gruposLote: [{ id, nombre, criterio: residente|mensualidad|general, cuposAuto, cuposMoto }].
   */
  posCollection: "POS",
  /** Vacío = usa planilladoDefaultSubcollectionsForAllParkings (LugMC421, LugJR112, …). */
  posSubcollections: [],
  /**
   * Auditoría de tiquetes POS purgados desde la web (estacionamientos.html).
   * Un documento por tiquete; varios comparten lotePurgaId si fue purga múltiple.
   */
  posTiquetesPurgadosCollection: "pos_tiquetes_purgados",
  /**
   * Plantillas de impresión térmica del POS (estacionamientos.html).
   * Colección: plantillas_impresion — documento por tipo (ej. tiquete_entrada).
   */
  plantillasImpresionCollection: "plantillas_impresion",
  /**
   * Tarifas por estacionamiento (estacionamientos.html).
   * Documento: tarifas/{idSede} — mismo ID que sedes/{idSede}.
   * Campos raíz: iva (%), tarifaPorMinuto, tarifaPlena, mensualidad (automóvil).
   * Por vehículo: moto, bicicleta, ciclomotor (mapas con tarifaPorMinuto, tarifaPlena, mensualidad).
   */
  tarifasCollection: "tarifas",
  /**
   * Cuentas de administración del portal (segundo paso tras Google).
   * Documento: administradores/{id} — campos típicos: email, nombre, rol, passwordEncrypted, salt, active.
   */
  administradoresCollection: "administradores",
  /**
   * Ajustes globales de la app móvil (seguridad.html).
   * Documento: app_settings/global_config — mapa featureVisibility { clave: bool }.
   * También en raíz: paymentPointVisible, syncButtonVisible, etc. (app móvil legacy).
   * Excepciones por sede: paymentPointHiddenSedes: string[] (IDs en colección sedes).
   */
  appSettingsCollection: "app_settings",
  globalConfigDocId: "global_config",
  /**
   * Cierres de caja (estadistico.html). Estructura típica:
   * cierres/{sede}/{nombreOperario}/{idCierre} — ej. …/E-5 - Falabella/luis jimenez/28-01-2026_15-14-45
   * La página lista subcolecciones por sede y suma importes en cada cierre.
   */
  cierresCollection: "cierres",
  /**
   * Recaudo POS por sede/fecha (planillas-cierres.html).
   * Documento: CIERRES/POS_{sede}_{YYYYMMDD}_{HHMMSS} — campo totalRecaudo.
   */
  cierresPosCollection: "CIERRES",
  /**
   * Facturas de venta generadas en caja (recaudos.html).
   * Colección plana: facturas_de_venta/{id} — monto, placa, sede, fechaFactura, etc.
   */
  facturasVentaCollection: "facturas_de_venta",
  facturasVentaCollectionLegacy: "caja_facturas",
  /** IVA % para desglosar monto cuando el documento no trae subtotal/IVA (misma lógica que caja: total/1.19). */
  recaudosIvaPorcentajeDefault: 19,
  /**
   * Nombre del campo donde viene el payload (texto base64 u objeto).
   * La app Android usa CashClosingEncryption.kt: AES/CBC/PKCS5 + IV 16 bytes prefijados (ver estadistico).
   */
  cierresEncryptedField: "encryptedData",
  /** Coinciden con CashClosingEncryption.kt (SECRET_KEY / ADDITIONAL_KEY). */
  cierresCashClosingSecretKey: "CashClosing2024!@#$%^&*()_+Secure",
  cierresCashClosingAdditionalKey: "LuganoParkingCashClosing2024!Secure",
  /**
   * Mismo valor que System.getProperty("user.name", "") al generar la clave en el teléfono.
   * Suele ser ""; si no descifra, probá "unknown" u otro valor según el dispositivo.
   */
  cierresCashClosingUserNameSuffix: "",
  /**
   * Nombres de subcolección bajo cierres/{sede}/{operador}/… (igual que en la app: operador en minúsculas).
   * Se unen con los IDs que devuelva listCollectionIds y con la colección «operators» de Firestore.
   */
  cierresOperatorSubcollectionsFallback: [],
  /**
   * Colección donde la app guarda operadores (campo name). Vacío = no consultar.
   * usuarios.html usa la misma colección para CRUD.
   * Campo opcional activo (bool): si es false, la app móvil no debe permitir login (tras validar contraseña).
   * Documentos antiguos sin el campo se tratan como activo === true.
   */
  cierresOperatorsCollection: "operators",
  /** Alias explícito para usuarios.html (misma colección que arriba). */
  operatorsCollection: "operators",
  /**
   * Prefijo del ID de operario nuevo (usuarios.html): Pes + inicial nombre + inicial apellido + 3 dígitos cédula.
   * Ej. Mauricio Rojas, cédula …421 → PesMR421
   */
  operatorUsernamePrefix: "Pes",
  /**
   * Nombres de subcolección de operador extra para collectionGroup (sedes «huérfanas» sin doc padre).
   * Ej.: ["michael eduardo carreño sanchez", "luis jimenez"]
   */
  cierresCollectionGroupProbeOperators: [],
  /**
   * Opcional: otro esquema (AES-GCM). Misma cadena → SHA-256 → clave; solo si seguís usando este modo.
   */
  cierresPayloadSecret: "",
  /**
   * Con cierresPayloadSecret: IV prefijado (12 o 16 bytes) en el base64 GCM.
   */
  cierresEncryptedIvPrepended: true
};
