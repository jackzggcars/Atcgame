// Concatenates src/*.js + THREE r128 (CDN) into single-file builds in dist/
const fs=require('fs');
const S=f=>fs.readFileSync('src/'+f,'utf8');
const page=S('page.html');
const i=page.indexOf('<div id="app">');
const head=page.slice(0,i), body=page.slice(i);
const js=['data.js','airports.js','sim1.js','sim2.js','audio.js','r3d.js','gfx.js','map.js','ui.js','tutorial.js'].map(S).join('\n;\n').replace(/<\/script/gi,'<\\/script');
const three='<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
const scripts=three+'\n<script>\n'+js+'\n</script>\n';
fs.mkdirSync('dist',{recursive:true});
fs.writeFileSync('dist/marlow-tower.html','<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'+head+'</head><body>\n'+body+scripts+'</body></html>');
fs.writeFileSync('dist/marlow-tower.artifact.html',page+scripts);
fs.copyFileSync('dist/marlow-tower.html','dist/index.html');
console.log('built dist/ (index.html is the deployable page)');
