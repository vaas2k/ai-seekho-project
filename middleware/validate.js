const validateBody = (schema) => {
  return (req, res, next) => {
    const body = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      const val = body[field];

      // 1. Required check
      if (rules.required && (val === undefined || val === null || val === '')) {
        return res.status(400).json({ error: `${field} is required` });
      }

      // If value is present, execute validation rules
      if (val !== undefined && val !== null && val !== '') {
        // 2. Type check
        if (rules.type) {
          if (rules.type === 'array') {
            if (!Array.isArray(val)) {
              return res.status(400).json({ error: `${field} must be of type array` });
            }
          } else if (rules.type === 'object') {
            if (typeof val !== 'object' || Array.isArray(val)) {
              return res.status(400).json({ error: `${field} must be of type object` });
            }
          } else if (typeof val !== rules.type) {
            return res.status(400).json({ error: `${field} must be of type ${rules.type}` });
          }
        }

        // 3. Max length check
        if (rules.maxLength && typeof val === 'string' && val.length > rules.maxLength) {
          return res.status(400).json({ error: `${field} cannot exceed ${rules.maxLength} characters` });
        }

        // 4. Enum validation
        if (rules.enum && Array.isArray(rules.enum) && !rules.enum.includes(val)) {
          return res.status(400).json({ error: `${field} must be one of [${rules.enum.join(', ')}]` });
        }
      }
    }

    next();
  };
};

module.exports = { validateBody };
