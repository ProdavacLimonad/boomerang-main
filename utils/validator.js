/**
 * Validátor vstupů pro Boomerang MCP Server
 * Používá JSON Schema pro validaci
 */
export class Validator {
  constructor() {
    // Definice schémat pro jednotlivé nástroje
    this.schemas = {
      analyzeTask: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            minLength: 10,
            maxLength: 5000,
            pattern: '^[^<>]+$' // Základní ochrana proti HTML/script injection
          },
          projectContext: {
            type: 'object',
            maxProperties: 50,
            additionalProperties: {
              type: ['string', 'number', 'boolean', 'array', 'object']
            }
          }
        },
        required: ['description'],
        additionalProperties: false
      },

      createSubtask: {
        type: 'object',
        properties: {
          parentTaskId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9-]{10,50}$' // Pouze alfanumerické znaky a pomlčky
          },
          subtaskConfig: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                minLength: 3,
                maxLength: 200,
                pattern: '^[^<>]+$'
              },
              description: {
                type: 'string',
                minLength: 10,
                maxLength: 2000,
                pattern: '^[^<>]+$'
              },
              type: {
                type: 'string',
                enum: ['design', 'implementation', 'testing', 'deployment', 'documentation', 'review']
              },
              priority: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                default: 'medium'
              }
            },
            required: ['title', 'description', 'type'],
            additionalProperties: false
          },
          contextToPass: {
            type: 'object',
            maxProperties: 20,
            additionalProperties: {
              type: ['string', 'number', 'boolean', 'array', 'object']
            }
          }
        },
        required: ['parentTaskId', 'subtaskConfig'],
        additionalProperties: false
      },

      executeSubtask: {
        type: 'object',
        properties: {
          subtaskId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9-]{10,50}$'
          },
          executionMode: {
            type: 'string',
            enum: ['simulation', 'real'],
            default: 'simulation'
          }
        },
        required: ['subtaskId'],
        additionalProperties: false
      },

      getSubtaskStatus: {
        type: 'object',
        properties: {
          subtaskId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9-]{10,50}$'
          }
        },
        required: ['subtaskId'],
        additionalProperties: false
      },

      mergeResults: {
        type: 'object',
        properties: {
          parentTaskId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9-]{10,50}$'
          }
        },
        required: ['parentTaskId'],
        additionalProperties: false
      },

      getTaskProgress: {
        type: 'object',
        properties: {
          parentTaskId: {
            type: 'string',
            pattern: '^[a-zA-Z0-9-]{10,50}$'
          }
        },
        required: ['parentTaskId'],
        additionalProperties: false
      }
    };
  }

  /**
   * Validuje data proti schématu
   * @param {string} schemaName - Název schématu
   * @param {object} data - Data k validaci
   * @returns {object} - { valid: boolean, errors: array }
   */
  validate(schemaName, data) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      return {
        valid: false,
        errors: [`Unknown schema: ${schemaName}`]
      };
    }

    const errors = [];
    this.validateAgainstSchema(data, schema, '', errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Rekurzivní validace proti schématu
   */
  validateAgainstSchema(data, schema, path, errors) {
    // Kontrola typu
    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const dataType = this.getType(data);
      
      if (!types.includes(dataType)) {
        errors.push(`${path || 'root'}: Expected type ${types.join(' or ')}, got ${dataType}`);
        return;
      }
    }

    // Validace pro objekty
    if (schema.type === 'object' && data !== null) {
      // Kontrola povinných polí
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in data)) {
            errors.push(`${path || 'root'}: Missing required field '${field}'`);
          }
        }
      }

      // Kontrola properties
      if (schema.properties) {
        for (const [key, value] of Object.entries(data)) {
          const fieldPath = path ? `${path}.${key}` : key;
          
          if (schema.properties[key]) {
            this.validateAgainstSchema(value, schema.properties[key], fieldPath, errors);
          } else if (schema.additionalProperties === false) {
            errors.push(`${fieldPath}: Unexpected property`);
          } else if (typeof schema.additionalProperties === 'object') {
            this.validateAgainstSchema(value, schema.additionalProperties, fieldPath, errors);
          }
        }
      }

      // Kontrola maxProperties
      if (schema.maxProperties && Object.keys(data).length > schema.maxProperties) {
        errors.push(`${path || 'root'}: Too many properties (max ${schema.maxProperties})`);
      }
    }

    // Validace pro stringy
    if (schema.type === 'string' && typeof data === 'string') {
      // Kontrola délky
      if (schema.minLength && data.length < schema.minLength) {
        errors.push(`${path || 'root'}: String too short (min ${schema.minLength} characters)`);
      }
      if (schema.maxLength && data.length > schema.maxLength) {
        errors.push(`${path || 'root'}: String too long (max ${schema.maxLength} characters)`);
      }

      // Kontrola patternu
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(data)) {
          errors.push(`${path || 'root'}: String does not match pattern ${schema.pattern}`);
        }
      }

      // Kontrola enum hodnot
      if (schema.enum && !schema.enum.includes(data)) {
        errors.push(`${path || 'root'}: Value must be one of: ${schema.enum.join(', ')}`);
      }
    }
  }

  /**
   * Získá typ hodnoty
   */
  getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  /**
   * Sanitizuje string vstup
   */
  sanitizeString(str) {
    if (typeof str !== 'string') return str;
    
    // Odstranit potenciálně nebezpečné znaky
    return str
      .replace(/[<>]/g, '') // Základní HTML
      .replace(/[\x00-\x1F\x7F]/g, '') // Kontrolní znaky
      .trim();
  }

  /**
   * Sanitizuje celý objekt
   */
  sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(obj);
    }

    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key);
      sanitized[sanitizedKey] = typeof value === 'object' 
        ? this.sanitizeObject(value) 
        : this.sanitizeString(value);
    }

    return sanitized;
  }
}

// Export singleton instance
export default new Validator();