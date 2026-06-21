const fs = require('fs');

let index = fs.readFileSync('index.html', 'utf8');
let autoAim = fs.readFileSync('auto_aim.js', 'utf8');

// Insert autoAim right before the script tag closes
index = index.replace('// Start loop\nrequestAnimationFrame(gameLoop);', autoAim + '\n// Start loop\nrequestAnimationFrame(gameLoop);');

fs.writeFileSync('index.html', index);
