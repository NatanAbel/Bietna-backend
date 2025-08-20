const crypto = require('crypto');
const isProd = process.env.NODE_ENV === 'production';

exports.ensureCsrfCookie = (req, res, next) => {
  if (!req.cookies['XSRF-TOKEN']) {
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: '/',
      // Allow both frontend.onrender.com and backend-api.onrender.com to read it
      ...(isProd ? { domain: '.onrender.com' } : {}),
    });
    res.cookie('XSRF-TOKEN', token, opts);
  }
  next();
};

exports.csrf = (req, res, next) => {
  const method = req.method.toUpperCase();
  const needs = ['POST','PUT','PATCH','DELETE'].includes(method) || (method === 'POST' && req.path === '/refresh');
  if (!needs) return next();
  const cookieVal = req.cookies['XSRF-TOKEN'];
  const headerVal = req.get('X-XSRF-TOKEN');
  if (!cookieVal || !headerVal || cookieVal !== headerVal) {
    return res.status(403).json({ message: 'CSRF token invalid' });
  }
  next();
};
