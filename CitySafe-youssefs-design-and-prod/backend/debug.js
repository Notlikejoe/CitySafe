import { spawn } from 'child_process';
const child = spawn('node', ['server.js']);
child.stdout.on('data', data => console.log('STDOUT:', data.toString()));
child.stderr.on('data', data => console.log('STDERR:', data.toString()));
child.on('close', code => console.log('Exited with code:', code));
