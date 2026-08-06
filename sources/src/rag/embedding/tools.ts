/**
 * Convierte un embedding representado como un arreglo de números
 * en un Buffer binario compatible con SQLite y sqlite-vec.
 *
 * Cada valor se convierte a un número de punto flotante de 32 bits
 * (4 bytes por dimensión), reduciendo el espacio ocupado frente a
 * los números estándar de JavaScript, que usan 64 bits.
 *
 * @param embedding Vector numérico generado por el modelo de embeddings.
 * @returns Buffer que contiene los valores Float32 serializados.
 */
export function serializeEmbedding(embedding: number[]): Buffer {
  // Convierte el arreglo number[] en un arreglo tipado Float32Array.
  // Cada número se almacena utilizando 32 bits, equivalentes a 4 bytes.
  const float32 = new Float32Array(embedding);

  // float32.buffer contiene los bytes internos del Float32Array
  // en forma de ArrayBuffer.
  //
  // Buffer.from crea un Buffer de Node.js usando esos mismos bytes,
  // permitiendo almacenarlos como un BLOB en SQLite.
  return Buffer.from(float32.buffer);
}
