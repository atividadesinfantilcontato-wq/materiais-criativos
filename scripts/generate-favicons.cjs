const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const publicDir = path.join(__dirname, '../public');
const svgPath = path.join(publicDir, 'favicon.svg');
const svgBuffer = fs.readFileSync(svgPath);

const sizes = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-48x48.png', size: 48 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'android-chrome-192x192.png', size: 192 },
  { name: 'android-chrome-512x512.png', size: 512 },
  { name: 'mstile-150x150.png', size: 150 },
];

const pngBuffers = {};

for (const item of sizes) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: {
      mode: 'width',
      value: item.size,
    },
  });
  const pngData = resvg.render();
  const buffer = pngData.asPng();
  fs.writeFileSync(path.join(publicDir, item.name), buffer);
  pngBuffers[item.size] = buffer;
  console.log(`Created ${item.name} (${item.size}x${item.size}) - ${buffer.length} bytes`);
}

function createIco(pngMap) {
  const sizesToInclude = [16, 32, 48];
  const numImages = sizesToInclude.length;
  
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + numImages * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(numImages, 4);

  const entries = [];
  const imageDataBuffers = [];

  for (const size of sizesToInclude) {
    const pngBuf = pngMap[size];
    const entry = Buffer.alloc(dirEntrySize);
    
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(pngBuf.length, 8);
    entry.writeUInt32LE(offset, 12);

    entries.push(entry);
    imageDataBuffers.push(pngBuf);

    offset += pngBuf.length;
  }

  return Buffer.concat([header, ...entries, ...imageDataBuffers]);
}

const icoBuffer = createIco(pngBuffers);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
console.log(`Created favicon.ico (${icoBuffer.length} bytes)`);
