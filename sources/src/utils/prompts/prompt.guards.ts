/**
 * Comprueba si el texto contiene una ruta explícita.
 *
 * Una ruta válida debe comenzar con:
 * - `./`  Ruta relativa actual
 * - `../` Ruta relativa superior
 * - `/`   Ruta absoluta Unix
 *
 * @example
 * hasExplicitPath("Busca en ./src");          // true
 * hasExplicitPath("Busca en ../shared");      // true
 * hasExplicitPath("Busca en /home/user");     // true
 * hasExplicitPath("Explica async/await");     // false
 * hasExplicitPath("Busca en src/services");   // false
 */
export function hasExplicitPath(prompt: string): boolean {
  const pathPattern =
    /(?:^|\s)(?:\.{1,2}\/|\/)[\w.-]+(?:\/[\w.-]+)*\/?(?=[\s.,;:!?'"`]|$)/;

  return pathPattern.test(prompt);
}
