import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { pgPool, redis, mongo, connectDependencies, orders, logs } from './db.js';

export const app = express();
app.use(cors()); app.use(express.json());
app.use((req, res, next) => {
  req.correlationId = req.header('x-correlation-id') || crypto.randomUUID();
  res.set('x-correlation-id', req.correlationId); const start = performance.now();
  res.on('finish', async () => { const ms = Math.round(performance.now() - start); try { await Promise.all([logs().insertOne({ correlationId:req.correlationId, method:req.method, path:req.path, status:res.statusCode, ms, at:new Date() }), redis.lpush('latency:ms', String(ms)), redis.ltrim('latency:ms', 0, 999)]); } catch {} console.info(JSON.stringify({ correlationId:req.correlationId, method:req.method, path:req.path, status:res.statusCode, ms })); }); next();
});
const actor = req => req.header('x-role') || 'customer';
const requireRole = (...roles) => (req,res,next) => roles.includes(actor(req)) ? next() : res.status(403).json({ error:'Forbidden for this role' });

app.get('/health', async (_req,res) => { const checks = await Promise.allSettled([pgPool.query('SELECT 1'), mongo.db().command({ping:1}), redis.ping()]); const tiers = ['postgres','mongo','redis'].reduce((o,n,i) => ({...o,[n]:checks[i].status === 'fulfilled' ? 'up':'down'}),{}); res.status(Object.values(tiers).every(x=>x==='up')?200:503).json({status:'ok', tiers}); });
app.get('/api/products', async (_req,res) => { const cached=await redis.get('products'); if(cached) return res.json({products:JSON.parse(cached), cached:true}); const {rows}=await pgPool.query('SELECT * FROM products ORDER BY id'); await redis.set('products',JSON.stringify(rows),'EX',15); res.json({products:rows,cached:false}); });
app.post('/api/products', requireRole('vendor','admin'), async (req,res) => { const {name,priceCents,stock,vendorId='vendor-1'}=req.body; const {rows}=await pgPool.query('INSERT INTO products(name,price_cents,stock,vendor_id) VALUES($1,$2,$3,$4) RETURNING *',[name,priceCents,stock,vendorId]); await redis.del('products'); res.status(201).json(rows[0]); });
app.patch('/api/products/:id/stock', requireRole('vendor','admin'), async (req,res) => { const {rows}=await pgPool.query('UPDATE products SET stock=$1 WHERE id=$2 RETURNING *',[req.body.stock,req.params.id]); if(!rows[0]) return res.status(404).json({error:'Product not found'}); await redis.del('products'); res.json(rows[0]); });
app.post('/api/orders', async (req,res) => { const {customerId,items}=req.body; if(!customerId || !Array.isArray(items)||!items.length) return res.status(400).json({error:'customerId and items are required'}); const client=await pgPool.connect(); try { await client.query('BEGIN'); const lineItems=[]; for(const item of items) { const {rows}=await client.query('SELECT id,name,price_cents,stock FROM products WHERE id=$1 FOR UPDATE',[item.productId]); const p=rows[0]; if(!p || p.stock < item.quantity) { const err=new Error(`Insufficient stock for product ${item.productId}`); err.status=409; throw err; } await client.query('UPDATE products SET stock=stock-$1 WHERE id=$2',[item.quantity,p.id]); lineItems.push({productId:p.id,name:p.name,quantity:item.quantity,unitPriceCents:p.price_cents}); } await client.query('COMMIT'); const order={customerId,items:lineItems,totalCents:lineItems.reduce((s,i)=>s+i.quantity*i.unitPriceCents,0),status:'placed',createdAt:new Date(),correlationId:req.correlationId}; const result=await orders().insertOne(order); await redis.del('products'); res.status(201).json({...order,id:result.insertedId}); } catch(e) { await client.query('ROLLBACK'); res.status(e.status||500).json({error:e.message}); } finally {client.release();} });
app.get('/api/orders', async (req,res) => { const filter=req.query.customerId ? {customerId:req.query.customerId}:{}; res.json({orders:await orders().find(filter).sort({createdAt:-1}).toArray()}); });
app.get('/api/metrics/latency', requireRole('admin'), async (_req,res) => { const values=(await redis.lrange('latency:ms',0,999)).map(Number).sort((a,b)=>a-b); const percentile=p=>values.length?values[Math.floor((values.length-1)*p)]:0; res.json({samples:values.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99)}); });
if(process.env.NODE_ENV !== 'test') connectDependencies().then(()=>app.listen(process.env.PORT||4000,()=>console.log('LocalLoop API listening'))).catch(e=>{console.error(e);process.exit(1)});
