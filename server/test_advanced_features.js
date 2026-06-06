
import http from 'http';

const PORT = 9001; // Assuming 9001 based on previous context
const API_PATH = '/api/containers/create';

const payload = JSON.stringify({
    name: 'test-advanced-container',
    image: 'alpine:latest',
    entrypoint: ['/bin/sh', '-c'],
    cmd: ['echo "Hello Advanced Features" && sleep 3600'],
    capAdd: ['NET_ADMIN'],
    sysctls: { 'net.ipv4.ip_forward': '1' },
    devices: [],
    restart: 'no',
    network: 'bridge',
    ports: [],
    volumes: [],
    env: [],
    alwaysPull: false
});

const options = {
    hostname: 'localhost',
    port: PORT,
    path: API_PATH,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length,
        'X-Endpoint-ID': 'local'
    }
};

console.log(`Sending request to http://localhost:${PORT}${API_PATH}`);
console.log('Payload:', payload);

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);

    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

// Write data to request body
req.write(payload);
req.end();
