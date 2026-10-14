import app from '../src/index.js';
import http from 'http';

const server = http.createServer(app);
server.listen(10002, async () => {
  try {
    const res = await fetch('http://localhost:10002/api/data', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://atelier-general-pos.vercel.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization,Content-Type'
      }
    });

    console.log('OPTIONS Status:', res.status);
    console.log('Access-Control-Allow-Origin:', res.headers.get('access-control-allow-origin'));
    console.log('Access-Control-Allow-Credentials:', res.headers.get('access-control-allow-credentials'));
    console.log('Access-Control-Allow-Methods:', res.headers.get('access-control-allow-methods'));
    console.log('Access-Control-Allow-Headers:', res.headers.get('access-control-allow-headers'));

    const getRes = await fetch('http://localhost:10002/api/data', {
      method: 'GET',
      headers: {
        'Origin': 'https://atelier-general-pos.vercel.app'
      }
    });

    console.log('GET Status:', getRes.status);
    console.log('GET Access-Control-Allow-Origin:', getRes.headers.get('access-control-allow-origin'));

    server.close();
    process.exit(0);
  } catch (err) {
    console.error('CORS Test Failed:', err);
    server.close();
    process.exit(1);
  }
});
