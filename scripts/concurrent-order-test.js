/**
 * Simple manual stress runner. Start Docker first, then run:
 * node scripts/concurrent-order-test.js
 */
const productResponse = await fetch('http://localhost:4000/api/products');
const { products } = await productResponse.json();
const product = products[0];
await fetch(`http://localhost:4000/api/products/${product.id}/stock`, { method:'PATCH', headers:{'content-type':'application/json','x-role':'admin'}, body:JSON.stringify({stock:1}) });
const results = await Promise.all([...Array(10)].map((_,i) => fetch('http://localhost:4000/api/orders', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customerId:`load-${i}`,items:[{productId:product.id,quantity:1}]})}).then(r=>r.status)));
console.log({ successfulOrders:results.filter(x=>x===201).length, rejectedOrders:results.filter(x=>x===409).length, statuses:results });
