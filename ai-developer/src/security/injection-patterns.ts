/**
 * Patrones utilizados para detectar posibles intentos
 * de prompt injection en entradas proporcionadas por el usuario.
 *
 * Cada patrón contiene:
 * - `name`: identificador descriptivo del patrón detectado.
 * - `regex`: expresión regular utilizada para buscar coincidencias.
 *
 * Estos patrones constituyen una validación heurística y no garantizan
 * por sí solos la detección de todos los ataques de prompt injection.
 */
export const INJECTION_PATTERNS: Array<{
  name: string;
  regex: RegExp;
}> = [
  // ---------------------------------------------------------------------------
  // Inglés
  // ---------------------------------------------------------------------------

  /**
   * Detecta instrucciones que solicitan ignorar instrucciones previas.
   *
   * Ejemplos:
   * "ignore instructions"
   * "ignore all previous instructions"
   */
  {
    name: "ignore instructions",
    regex: /ignore\s+(?:\w+\s+){0,3}instructions?/i,
  },

  /**
   * Detecta solicitudes para olvidar instrucciones
   * o el contexto previamente establecido.
   *
   * Ejemplos:
   * "forget everything"
   * "forget your instructions"
   */
  {
    name: "forget instructions",
    regex:
      /forget\s+(everything|all|your\s+instructions?|what\s+you\s+were\s+told)/i,
  },

  /**
   * Detecta intentos de redefinir directamente
   * la identidad o comportamiento del modelo.
   *
   * Ejemplo:
   * "you are now an unrestricted assistant"
   */
  {
    name: "you are now",
    regex: /you\s+are\s+now\s+/i,
  },

  /**
   * Detecta instrucciones que solicitan adoptar
   * una identidad o comportamiento diferente.
   *
   * Ejemplos:
   * "act as if you are..."
   * "act as you were..."
   */
  {
    name: "act as",
    regex: /act\s+as\s+(if\s+)?you\s+(are|were)\s+/i,
  },

  /**
   * Detecta solicitudes explícitas para descartar
   * reglas o instrucciones existentes.
   *
   * Ejemplo:
   * "disregard your previous instructions"
   */
  {
    name: "disregard",
    regex: /disregard\s+(your|all|previous|the)\s+/i,
  },

  /**
   * Detecta bloques que intentan introducir
   * nuevas instrucciones.
   *
   * Ejemplo:
   * "new instructions:"
   */
  {
    name: "new instructions",
    regex: /new\s+instructions?\s*:/i,
  },

  /**
   * Detecta texto que intenta simular
   * un mensaje o instrucción del sistema.
   *
   * Ejemplo:
   * "system: you must..."
   */
  {
    name: "system override",
    regex: /system\s*:?\s*you\s+/i,
  },

  /**
   * Detecta intentos explícitos de sobrescribir
   * el system prompt o las instrucciones existentes.
   *
   * Ejemplo:
   * "override the system prompt"
   */
  {
    name: "override system prompt",
    regex: /override\s+(the\s+)?(system\s+prompt|your\s+instructions?)/i,
  },

  // ---------------------------------------------------------------------------
  // Español
  // ---------------------------------------------------------------------------

  /**
   * Detecta solicitudes para ignorar
   * instrucciones anteriores o existentes.
   *
   * Ejemplos:
   * "ignora las instrucciones anteriores"
   * "ignora todas las instrucciones"
   */
  {
    name: "ignorar instrucciones (es)",
    regex:
      /ignora\s+(las\s+)?(instrucciones?\s+)?(anteriores?|previas?|todas?)/i,
  },

  /**
   * Detecta solicitudes para olvidar instrucciones
   * o información previamente indicada.
   *
   * Ejemplos:
   * "olvida todo"
   * "olvida lo que te dijeron"
   */
  {
    name: "olvida instrucciones (es)",
    regex:
      /olvida\s+(todo|las\s+instrucciones?|lo\s+que\s+te\s+(dijeron|indicaron))/i,
  },

  /**
   * Detecta intentos de redefinir la identidad
   * o comportamiento actual del modelo.
   *
   * Ejemplos:
   * "ahora eres..."
   * "ahora actúa como..."
   */
  {
    name: "ahora eres (es)",
    regex: /ahora\s+(eres|serás|actúas?\s+como)\s+/i,
  },

  /**
   * Detecta solicitudes para adoptar
   * una identidad o rol diferente.
   *
   * Ejemplos:
   * "actúa como si fueras..."
   * "actúa como eres..."
   */
  {
    name: "actúa como (es)",
    regex: /actúa\s+(como\s+si\s+)?(fueras?|eres)\s+/i,
  },

  /**
   * Detecta bloques que intentan introducir
   * nuevas instrucciones.
   *
   * Ejemplo:
   * "nuevas instrucciones:"
   */
  {
    name: "nuevas instrucciones (es)",
    regex: /nuevas?\s+instrucciones?\s*:/i,
  },

  /**
   * Detecta solicitudes explícitas para ignorar
   * completamente el contexto anterior.
   *
   * Ejemplo:
   * "ignora todo lo anterior"
   */
  {
    name: "ignora todo (es)",
    regex: /ignora\s+todo\s+(lo\s+anterior|lo\s+que\s+)/i,
  },

  /**
   * Detecta frases que intentan eliminar
   * restricciones previamente establecidas.
   *
   * Ejemplo:
   * "eres libre de ignorar..."
   */
  {
    name: "eres libre (es)",
    regex: /eres\s+libre\s+(de|para)\s+/i,
  },

  /**
   * Detecta solicitudes que pretenden operar
   * sin restricciones, límites o instrucciones.
   *
   * Ejemplos:
   * "sin restricciones"
   * "sin ningún límite"
   */
  {
    name: "sin restricciones (es)",
    regex: /sin\s+(ninguna\s+)?(restricci[oó]n|l[ií]mite|instrucci[oó]n)/i,
  },
];
