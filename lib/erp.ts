export type Product={id:string;sku:string;name:string;asin:string;category:string;unit:string;cost:number;price:number;min:number;lead:number};
export type Partner={id:string;name:string;type:'supplier'|'customer';contact:string;phone:string};
export type Warehouse={id:string;name:string;type:string};
export type Stock={productId:string;warehouseId:string;qty:number;value:number};
export type Line={productId:string;qty:number;price:number;cost?:number};
export type Doc={id:string;number:string;type:'purchase'|'sale'|'transfer';date:string;partnerId:string;warehouseId:string;toWarehouseId:string;currency:string;rate:number;fee:number;note:string;items:Line[];status:'draft'|'shipped'|'approved'|'void';total:number;paid:number;created:string};
export type Payment={id:string;docId:string;date:string;amount:number;note:string};
export type State={products:Product[];partners:Partner[];warehouses:Warehouse[];stock:Stock[];docs:Doc[];payments:Payment[];logs:{id:string;at:string;text:string}[];settings:{company:string;rate:number;market:string}};
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const uid=()=>crypto.randomUUID();
export function emptyState():State{return{products:[],partners:[],warehouses:[{id:'cn',name:'深圳国内仓',type:'国内仓'},{id:'fba-us',name:'美国 FBA 仓',type:'FBA'},{id:'overseas',name:'美国海外仓',type:'海外仓'}],stock:[],docs:[],payments:[],logs:[],settings:{company:'LeeJan 跨境贸易',rate:7.1,market:'Amazon US'}};}
function fail(message:string):never{throw new Error(message)}
function str(v:unknown,label:string,max=160){if(typeof v!=='string'||!v.trim()||v.length>max)fail(label+'不能为空或过长');return(v as string).trim();}
function num(v:unknown,label:string,min=0,max=1e10){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)fail(label+'超出有效范围');return v as number;}
function integer(v:unknown,label:string,min=0,max=1e8){const n=num(v,label,min,max);if(!Number.isInteger(n))fail(label+'必须为整数');return n;}
function date(v:unknown){const s=str(v,'日期',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)fail('日期无效');return s;}
export function stockOf(s:State,p:string,w:string){let row=s.stock.find(x=>x.productId===p&&x.warehouseId===w);if(!row){row={productId:p,warehouseId:w,qty:0,value:0};s.stock.push(row)}return row;}
function take(s:State,p:string,w:string,q:number){const r=stockOf(s,p,w);if(r.qty<q)fail('库存不足：'+s.products.find(x=>x.id===p)?.sku);const cost=q===r.qty?r.value:Math.round(r.value*q/r.qty);r.qty-=q;r.value-=cost;return cost;}
function add(s:State,p:string,w:string,q:number,v:number){const r=stockOf(s,p,w);r.qty+=q;r.value+=v;}
export function applyAction(source:State,action:string,p:any):State{
 const s:State=structuredClone(source);let log='';
 if(action==='product'){
  const item:Product={id:p.id||uid(),sku:str(p.sku,'SKU',64),name:str(p.name,'商品名称'),asin:String(p.asin||'').trim().toUpperCase(),category:String(p.category||'其他').slice(0,60),unit:String(p.unit||'件').slice(0,16),cost:integer(p.cost,'参考成本'),price:integer(p.price,'参考售价'),min:integer(p.min,'安全库存'),lead:integer(p.lead,'补货周期',1,365)};
  if(item.asin&&!/^[A-Z0-9]{10}$/.test(item.asin))fail('ASIN 应为 10 位字母或数字');
  if(s.products.some(x=>x.sku.toLowerCase()===item.sku.toLowerCase()&&x.id!==item.id))fail('SKU 已存在');
  const i=s.products.findIndex(x=>x.id===item.id);if(p.id&&i<0)fail('商品不存在');if(i>=0)s.products[i]=item;else s.products.push(item);log='保存商品 '+item.sku;
 }else if(action==='partner'){
  if(!['supplier','customer'].includes(p.type))fail('往来类型无效');s.partners.push({id:uid(),name:str(p.name,'名称'),type:p.type,contact:String(p.contact||'').slice(0,80),phone:String(p.phone||'').slice(0,80)});log='新增往来单位 '+p.name;
 }else if(action==='warehouse'){
  const name=str(p.name,'仓库名称',60);if(s.warehouses.some(x=>x.name===name))fail('仓库名称已存在');if(!['国内仓','FBA','海外仓'].includes(p.type))fail('仓库类型无效');s.warehouses.push({id:uid(),name,type:p.type});log='新增仓库 '+name;
 }else if(action==='document'){
  if(!['purchase','sale','transfer'].includes(p.type))fail('单据类型无效');
  if(!s.warehouses.some(x=>x.id===p.warehouseId))fail('请选择仓库');
  if(p.type==='transfer'&&(!s.warehouses.some(x=>x.id===p.toWarehouseId)||p.toWarehouseId===p.warehouseId))fail('调入仓与调出仓必须不同');
  if(p.type!=='transfer'&&!s.partners.some(x=>x.id===p.partnerId&&x.type===(p.type==='purchase'?'supplier':'customer')))fail('请选择对应往来单位');
  if(!['CNY','USD','EUR'].includes(p.currency))fail('币种无效');
  const rate=p.currency==='CNY'?1:num(p.rate,'汇率',0.0001,1000);
  if(!Array.isArray(p.items)||!p.items.length||p.items.length>50)fail('请添加 1–50 条明细');
  const seen=new Set();const items:Line[]=p.items.map((x:any)=>{if(!s.products.some(y=>y.id===x.productId))fail('商品不存在');if(seen.has(x.productId))fail('同一商品请合并为一行');seen.add(x.productId);return{productId:x.productId,qty:integer(x.qty,'数量',1),price:p.type==='transfer'?0:integer(x.price,'单价',1)};});
  const fee=p.type==='transfer'?0:integer(p.fee||0,'运杂费');const total=p.type==='transfer'?0:Math.round(items.reduce((a,x)=>a+x.qty*x.price,0)*rate)+fee;integer(total,'单据总额',0,1e12);
  const id=uid();s.docs.push({id,number:({purchase:'PO',sale:'SO',transfer:'TR'}as any)[p.type]+today().replaceAll('-','')+'-'+id.slice(0,6).toUpperCase(),type:p.type,date:date(p.date),partnerId:p.partnerId||'',warehouseId:p.warehouseId,toWarehouseId:p.toWarehouseId||'',currency:p.currency,rate,fee,note:String(p.note||'').slice(0,500),items,status:'draft',total,paid:0,created:new Date().toISOString()});log='创建单据 '+s.docs.at(-1)!.number;
 }else if(['approve','receive','void'].includes(action)){
  const d=s.docs.find(x=>x.id===p.id);if(!d)fail('单据不存在');
  if(action==='void'){if(d.status!=='draft')fail('仅草稿可作废');d.status='void';log='作废 '+d.number;}
  else if(action==='receive'){if(d.type!=='transfer'||d.status!=='shipped')fail('仅在途调拨单可确认到仓');for(const x of d.items)add(s,x.productId,d.toWarehouseId,x.qty,x.cost||0);d.status='approved';log='确认到仓 '+d.number;}
  else{if(d.status!=='draft')fail('单据已处理，请刷新');let allocated=0;
   for(let i=0;i<d.items.length;i++){const x=d.items[i];if(d.type==='purchase'){const value=i===d.items.length-1?d.total-allocated:Math.round(x.qty*x.price*d.rate+d.fee*x.qty*x.price/d.items.reduce((a,y)=>a+y.qty*y.price,0));allocated+=value;add(s,x.productId,d.warehouseId,x.qty,value);x.cost=value;}else x.cost=take(s,x.productId,d.warehouseId,x.qty);}
   d.status=d.type==='transfer'?'shipped':'approved';log=(d.type==='transfer'?'发运 ':'审核 ')+d.number;
  }
 }else if(action==='payment'){
  const d=s.docs.find(x=>x.id===p.docId);if(!d||d.type==='transfer'||d.status!=='approved')fail('请选择已审核的采购或销售单');const amount=integer(p.amount,'收付款金额',1);if(amount>d.total-d.paid)fail('金额超过未结余额');s.payments.push({id:uid(),docId:d.id,date:date(p.date),amount,note:String(p.note||'').slice(0,300)});d.paid+=amount;log='登记'+(d.type==='sale'?'收款 ':'付款 ')+d.number;
 }else if(action==='settings'){
  s.settings={company:str(p.company,'企业名称',80),rate:num(p.rate,'美元参考汇率',0.0001,1000),market:str(p.market,'主要站点',80)};log='更新系统设置';
 }else if(action==='importProducts'){
  if(!Array.isArray(p.rows)||p.rows.length>500||!p.rows.length)fail('每次请导入 1–500 条商品');let next=s;for(const row of p.rows)next=applyAction(next,'product',row);return next;
 }else if(action==='clear'){
  if(p.confirm!=='清空正式数据')fail('确认文字不正确');const e=emptyState();e.settings=s.settings;return e;
 }else fail('操作不受支持');
 s.logs.unshift({id:uid(),at:new Date().toISOString(),text:log});s.logs=s.logs.slice(0,1000);return s;
}
export function makeDemo():State{
 let s=emptyState();const products=[['ICE-08-BLK','冰钻替换刀片套装','B0DEMO0001','户外工具',4200,2399,80,40],['MAT-02-GRY','硅胶隔热垫 · 灰色','B0DEMO0002','家居用品',1350,1599,120,30],['BAG-03-NVY','旅行收纳袋 6 件套','B0DEMO0003','旅行配件',2800,2499,100,35],['LED-01-WHT','磁吸感应灯 · 双只装','B0DEMO0004','家居照明',3600,2999,90,45],['PET-05-GRN','宠物慢食碗','B0DEMO0005','宠物用品',1850,1899,100,35],['ORG-04-CLR','桌面理线收纳盒','B0DEMO0006','办公用品',2200,1999,80,30]];
 products.forEach((x,i)=>s.products.push({id:'p'+i,sku:String(x[0]),name:String(x[1]),asin:String(x[2]),category:String(x[3]),unit:'件',cost:Number(x[4]),price:Number(x[5]),min:Number(x[6]),lead:Number(x[7])}));
 s.partners=[{id:'v1',name:'示例供应商 A',type:'supplier',contact:'示例联系人 A',phone:''},{id:'v2',name:'示例供应商 B',type:'supplier',contact:'示例联系人 B',phone:''},{id:'c1',name:'Amazon US · 主店铺',type:'customer',contact:'运营团队',phone:''},{id:'c2',name:'Amazon CA · 加拿大店',type:'customer',contact:'运营团队',phone:''}];
 const day=(offset:number)=>{const d=new Date(today()+'T12:00:00+08:00');d.setDate(d.getDate()-offset);return d.toISOString().slice(0,10)};
 for(let i=0;i<6;i++){s=applyAction(s,'document',{type:'purchase',date:day(27),partnerId:i%2?'v2':'v1',warehouseId:'cn',currency:'CNY',rate:1,fee:0,items:[{productId:'p'+i,qty:[700,1100,800,650,900,500][i],price:s.products[i].cost}]});s=applyAction(s,'approve',{id:s.docs.at(-1)!.id});s=applyAction(s,'document',{type:'transfer',date:day(24),warehouseId:'cn',toWarehouseId:'fba-us',currency:'CNY',rate:1,items:[{productId:'p'+i,qty:[450,750,550,500,650,350][i],price:0}]});s=applyAction(s,'approve',{id:s.docs.at(-1)!.id});s=applyAction(s,'receive',{id:s.docs.at(-1)!.id});}
 for(let i=25;i>=0;i--){const n=i%6;s=applyAction(s,'document',{type:'sale',date:day(i),partnerId:'c1',warehouseId:'fba-us',currency:'USD',rate:7.1,fee:0,items:[{productId:'p'+n,qty:15+(i%5)*10,price:s.products[n].price}],note:'演示销售汇总'});s=applyAction(s,'approve',{id:s.docs.at(-1)!.id});if(i%3!==0)s=applyAction(s,'payment',{docId:s.docs.at(-1)!.id,date:day(i),amount:s.docs.at(-1)!.total,note:'演示回款'});}
 s=applyAction(s,'document',{type:'transfer',date:day(2),warehouseId:'cn',toWarehouseId:'fba-us',currency:'CNY',rate:1,items:[{productId:'p3',qty:120,price:0},{productId:'p0',qty:100,price:0}],note:'FBA 补货 · 海运渠道'});s=applyAction(s,'approve',{id:s.docs.at(-1)!.id});
 s=applyAction(s,'document',{type:'purchase',date:today(),partnerId:'v2',warehouseId:'cn',currency:'CNY',rate:1,items:[{productId:'p4',qty:400,price:1850}],note:'下一批补货采购'});return s;
}
