import { readFileSync, writeFileSync } from 'node:fs';
const sql=readFileSync(new URL('../../Practica03/tablas.sql',import.meta.url),'utf8');
function split(s){let a=[],st=0,d=0,q='';for(let i=0;i<s.length;i++){const c=s[i];if(q){if(c==='\\'){i++;continue}if(c===q){q=''}continue}if(c==='`'||c==="'"){q=c;continue}if(c==='(')d++;if(c===')')d--;if(c===','&&!d){a.push(s.slice(st,i).trim());st=i+1}}a.push(s.slice(st).trim());return a}
const tables=[];
for(const m of sql.matchAll(/CREATE TABLE\s+`([^`]+)`\s*\(([\s\S]*?)\)\s*ENGINE=/gi)){
 const [full,name,body]=m, cols=[], indexes=[], fks=[], checks=[];
 for(const p of split(body)){let x;
  if((x=p.match(/^`([^`]+)`\s+(.+)$/s))){cols.push({name:x[1],decl:x[2]});continue}
  if((x=p.match(/^PRIMARY KEY\s*\(([^)]+)\)/i)))indexes.push({kind:'PRIMARY KEY',name:'PRIMARY KEY',columns:x[1].replaceAll('`','')});
  else if((x=p.match(/^(UNIQUE KEY|UNIQUE INDEX|KEY|INDEX)\s+`([^`]+)`\s*\(([^)]+)\)/i)))indexes.push({kind:/UNIQUE/i.test(x[1])?'UNIQUE':'INDEX',name:x[2],columns:x[3].replaceAll('`','')});
  else if((x=p.match(/^CONSTRAINT\s+`([^`]+)`\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+`([^`]+)`\s*\(([^)]+)\)(.*)$/is)))fks.push({name:x[1],columns:x[2].replaceAll('`',''),table:x[3],refColumns:x[4].replaceAll('`',''),actions:x[5].trim()});
  else if((x=p.match(/^CONSTRAINT\s+`([^`]+)`\s+CHECK\s*\((.*)\)$/is)))checks.push({name:x[1],expr:x[2]});
 }
 const tail=sql.slice(m.index+full.length).match(/^[^;]*;/)?.[0]||';';tables.push({name,cols,indexes,fks,checks,create:full+tail});
}
function describe(t,c){
 const d=c.decl, mt=d.match(/^([A-Za-z]+(?:\([^)]*\))?(?:\s+unsigned)?)/i), type=mt?.[1]||d.split(/\s/)[0], en=d.match(/\benum\((.*?)\)/i);
 const nn=/\bNOT NULL\b/i.test(d), ai=/\bAUTO_INCREMENT\b/i.test(d), gen=/\bGENERATED ALWAYS AS/i.test(d);
 const def=d.match(/\bDEFAULT\s+((?:'[^']*'|b'[^']*'|NULL|CURRENT_TIMESTAMP(?:\(\))?|[^\s,]+))/i)?.[1]||'—';
 const ix=t.indexes.filter(i=>i.columns.split(/,\s*/).includes(c.name)), fk=t.fks.filter(f=>f.columns.split(/,\s*/).includes(c.name)), ck=t.checks.filter(k=>k.expr.includes('`'+c.name+'`'));
 const pk=ix.some(i=>i.kind==='PRIMARY KEY'); let example='';
 if(ai)example='Generado por MySQL';else if(gen)example='Calculado por MySQL';else if(en)example=en[1].match(/'((?:\\.|[^'])*)'/)?.[0]||'—';else if(/\bbit\s*\(1\)/i.test(d))example="b'1'";else if(/\b(?:tinyint|smallint|mediumint|int|bigint)\b/i.test(d))example=/quantity|stock|count|total_products/i.test(c.name)?'1':/unsigned/i.test(d)?'1':'0';else if(/\bdecimal\((\d+),(\d+)\)/i.test(d)){const scale=+d.match(/\bdecimal\((\d+),(\d+)\)/i)[2];example=scale?'1.'+'0'.repeat(scale):'1'}else if(/\bdatetime\b/i.test(d))example="'2026-01-15 12:30:00'";else if(/\bchar\((\d+)\)/i.test(d))example="'"+'A'.repeat(Math.min(4,+d.match(/\bchar\((\d+)\)/i)[1]))+"'";else if(/\bvarchar\((\d+)\)/i.test(d)){const lim=+d.match(/\bvarchar\((\d+)\)/i)[1];example="'"+(/email/i.test(c.name)?'ana@example.test':'Ejemplo').slice(0,lim)+"'"}else if(/\btext\b/i.test(d))example="'Texto de ejemplo'";
 const intSpec=type.match(/^(tinyint|smallint|mediumint|int|bigint)/i), intBits={tinyint:8,smallint:16,mediumint:24,int:32,bigint:64};
 let range='';if(intSpec){const bits=intBits[intSpec[1].toLowerCase()],u=/\bunsigned\b/i.test(d);range=u?`0..${(2n**BigInt(bits))-1n}`:`-${2n**BigInt(bits-1)}..${(2n**BigInt(bits-1))-1n}`}
 const dec=d.match(/\bdecimal\((\d+),(\d+)\)/i);let decRange='';if(dec){const p=+dec[1],scale=+dec[2],whole='9'.repeat(p-scale)||'0',fraction='9'.repeat(scale);decRange=`±${whole}${scale?'.'+fraction:''}`}
 const acceptance=en?'ENUM('+en[1]+')':range?`Entero ${range} (${type})`:dec?`Decimal ${decRange}; precisión ${dec[1]}, escala ${dec[2]}`:/\bvarchar\((\d+)\)/i.test(d)?`Texto de hasta ${type.match(/\d+/)[0]} caracteres`:/\bchar\((\d+)\)/i.test(d)?`Cadena de longitud fija ${type.match(/\d+/)[0]}`:/\bbit\(1\)/i.test(d)?'Un bit (0 o 1)':gen?'Valor calculado por la expresión SQL':type;
 const keys=[...ix.map(i=>i.kind+(i.kind==='PRIMARY KEY'?' ('+i.columns+')':i.kind==='UNIQUE'?' '+i.name+' ('+i.columns+')':'')),...fk.map(f=>'FK '+f.name+' → '+f.table+'('+f.refColumns+')'),...ck.map(k=>'CHECK '+k.name+': '+k.expr)].join('; ')||'—';
 const name=c.name.toLowerCase(), num=/^(tinyint|smallint|mediumint|int|bigint|decimal|float|double)/i.test(type), qty=/price|cost|quantity|stock|stok|latitude|longitude|total_products/i.test(name);
 const description=gen?'Derivado por la expresión GENERATED ALWAYS AS declarada en el SQL.':/\bID\b|_ID$/i.test(c.name)?'Identificador/referencia sugerido por el nombre; significado funcional no declarado.':/date|time/i.test(name)?'Marca temporal inferida por el nombre; el evento asociado no se documenta.':/status|operation|component_type|provider|label|name|email|nickname|code|key|description|password/i.test(name)?'Campo descriptivo o categórico inferido por nombre; semántica de negocio desconocida.':'Significado semántico no determinable solo con el esquema.';
 const temporal=/date|time/.test(name), invalid=en?`Valor inválido: otro literal fuera de ${en[1]}.`:ck.length?`Valor inválido si viola ${ck.map(k=>k.name).join(', ')}.`:'';
 const update=d.match(/\bON UPDATE\s+CURRENT_TIMESTAMP(?:\(\))?/i)?.[0]||'', generatedExpr=d.match(/GENERATED ALWAYS AS\s*\((.*?)\)\s*(VIRTUAL|STORED)?/i);
 return {name:c.name,type,description,acceptance,nullable:nn?'No':'Sí',required:!nn?'No, permite NULL':ai||gen||def!=='—'?'No para INSERT: generación/default; técnicamente NOT NULL':'Sí para INSERT sin valor/default; técnicamente NOT NULL',keys,default:def,example:gen?'1.00 (quantity=1 y unit_price=1.00)':example,invalid,cardinality:'Monovalor; cada fila contiene un escalar en esta columna.',origin:gen?'Derivado: expresión generadora explícita.':'Almacenado físicamente; productor/origen no determinable solo con esquema.',primary:pk,nature:num&&qty?'Cuantitativa; magnitud sugerida por nombre.':temporal?'Cuantitativa temporal; instante ordenable, significado funcional no especificado.':num?'Cualitativa; valor numérico usado como identificador/código según nombre.':'Cualitativa; texto/categoría según nombre/tipo.',formal:`${c.name}: ${type}${nn?' NOT NULL':' NULL'}${ai?' AUTO_INCREMENT':''}${def!=='—'?' DEFAULT '+def:''}${update?' '+update:''}${generatedExpr?' GENERATED ALWAYS AS ('+generatedExpr[1]+') '+(generatedExpr[2]||''):''}${pk?' · PRIMARY KEY':''}${fk.length?' · FOREIGN KEY':''}${ix.some(i=>i.kind==='UNIQUE')?' · UNIQUE':''}${ck.length?' · CHECK':''}`,domain:en?'Valores ENUM cerrados: '+en[1]+'.':ck.length?'Límite técnico mediante '+ck.map(k=>k.name+' ('+k.expr+')').join('; ')+'. Dominio semántico desconocido.':'Dominio técnico según tipo/longitud SQL'+(def!=='—'?'; DEFAULT '+def:'')+'. Dominio semántico no determinable solo con esquema.'};
}
const data=tables.map(t=>({...t,fields:t.cols.map(c=>describe(t,c))}));if(data.length!==15)throw Error('Se detectaron '+data.length+' tablas, se esperaban 15');
const visualCSS=`
:root{--ink:#000000;--carbon:#252B2A;--secondary:#343B39;--paper:#fffef8;--line:3px solid var(--ink);--shadow:7px 7px 0 var(--ink)}
body{color:var(--carbon)}
.sidebar,.hero,.table-title,.chip,.searchbox button,.copy{color:var(--carbon)}
.nav a,.card a,.table-title a{color:var(--carbon)}
.searchbox{background:var(--carbon)}
.status{color:#f7fbfa}
.section-head h2,.section-head span,.hero h1,.eyebrow,.brand,.card h3,.table-title h3{color:var(--carbon)}
.inference,.note{color:var(--secondary)}
.table-wrap{overflow-x:auto;overflow-y:visible}
table{table-layout:auto;min-width:3140px;font-size:13px;line-height:1.5}
th,td{padding:13px 14px;line-height:1.5;vertical-align:top;overflow-wrap:normal;word-break:normal}
th{background:var(--carbon);color:#ffffff;font-size:12px;padding-top:15px;padding-bottom:15px}
tbody tr:nth-child(even){background:#f0f7f4}
tbody tr:hover{background:#fff9c2}
td:nth-child(1){min-width:130px}
td:nth-child(2){min-width:150px}
td:nth-child(3){min-width:260px}
td:nth-child(4){min-width:280px}
td:nth-child(5){min-width:110px}
td:nth-child(6){min-width:240px}
td:nth-child(7){min-width:220px}
td:nth-child(8){min-width:140px}
td:nth-child(9){min-width:220px}
td:nth-child(10){min-width:210px}
td:nth-child(11){min-width:250px}
td:nth-child(12){min-width:150px}
td:nth-child(13){min-width:230px}
td:nth-child(14){min-width:270px}
td:nth-child(15){min-width:280px}
td:first-child{white-space:nowrap}
td code{white-space:normal;overflow-wrap:normal;word-break:normal;line-height:1.5}
td:nth-child(1) code,td:nth-child(2) code{white-space:nowrap}
pre{background:var(--carbon);color:#f3f7f6;line-height:1.55}
`;
const html=readFileSync(new URL('./template.html',import.meta.url),'utf8').replace('</style>',visualCSS+'</style>').replace('__DATA__',JSON.stringify(data).replace(/</g,'\\u003c'));
const byName=new Map(data.map(t=>[t.name,t]));
for(const t of data)for(const f of t.fks){const target=byName.get(f.table);if(!target)throw Error(`FK ${f.name} apunta a tabla ausente: ${f.table}`);for(const col of f.refColumns.split(/,\s*/))if(!target.cols.some(c=>c.name===col))throw Error(`FK ${f.name} apunta a columna ausente: ${f.table}.${col}`)}
if(data.reduce((n,t)=>n+t.fields.length,0)!==111)throw Error('El total de columnas cambió; revisar extracción');
for(const hook of ['addEventListener(\'input\'',"addEventListener('keydown'",'navigator.clipboard.writeText','id="nav"','class="copy"'])if(!html.includes(hook))throw Error(`Falta funcionalidad HTML: ${hook}`);
new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
writeFileSync(new URL('./diccionario-datos-mysql.html',import.meta.url),html);console.log(JSON.stringify({tables:data.length,columns:data.reduce((n,t)=>n+t.fields.length,0),fks:data.reduce((n,t)=>n+t.fks.length,0),names:data.map(t=>t.name),checks:{allForeignKeyTargetsExist:true,interactionHooks:true,inlineScriptSyntax:true}}));
