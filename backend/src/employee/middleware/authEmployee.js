import jwt from 'jsonwebtoken';

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is missing in production');
    }
    console.warn('WARNING: JWT_SECRET is not set in environment.');
  }
  return secret || 'dev-fallback-local-only-secret-key-change-in-prod';
};

export const verifyEmployeeToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
    if (decoded.role !== 'employee') {
      return res.status(403).json({ message: 'Access denied: not an employee token' });
    }
    req.employee = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
