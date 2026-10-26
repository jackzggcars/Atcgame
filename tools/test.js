const fs=require('fs'),vm=require('vm');
const src=['data.js','sim1.js','sim2.js'].map(f=>fs.readFileSync('/home/claude/atc/src/'+f,'utf8')).join('\n')+
`\n;globalThis.__T={G,newGame,step,command,buildReplies,quickCmds,csName,request,setLight,changeRunway,NODES,route,PH,say,spawnDep,spawnArr,on,parseCmd,normText};`;
vm.runInThisContext(src);
const T=globalThis.__T;
module.exports=T;
