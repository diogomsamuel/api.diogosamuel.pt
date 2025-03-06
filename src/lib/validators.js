// Validador para tipos de medidas corporais
export function validateMeasurementType(type) {
  const validTypes = ['chest', 'waist', 'hips', 'arms', 'thighs', 'calves'];
  return validTypes.includes(type);
} 