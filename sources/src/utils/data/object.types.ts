/**
 * Objeto con claves de tipo `string` y valores desconocidos.
 *
 * @example
 * const metadata: StringKeyedObject = {
 *   name: 'Mauricio',
 *   age: 30,
 * };
 */
export type StringKeyedObject = Record<string, unknown>;

/**
 * Objeto con claves numéricas y valores desconocidos.
 *
 * @example
 * const productsById: NumberKeyedObject = {
 *   100: { name: 'Keyboard' },
 *   200: { name: 'Mouse' },
 * };
 */
export type NumberKeyedObject = Record<number, unknown>;
