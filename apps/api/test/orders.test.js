import request from 'supertest';
// Integration test: run after docker compose is up; it demonstrates one winner when stock is one.
describe('atomic inventory', () => {
  test('concurrent orders do not oversell', async () => {
    const base = process.env.API_URL || 'http://localhost:4000';
    const products = (await request(base).get('/api/products')).body.products;
    const target = products[0];
    await request(base).patch(`/api/products/${target.id}/stock`).set('x-role','admin').send({stock:1});
    const submit = n => request(base).post('/api/orders').send({customerId:`stress-${n}`,items:[{productId:target.id,quantity:1}]});
    const results=await Promise.all([submit(1),submit(2)]);
    expect(results.filter(r=>r.status===201)).toHaveLength(1);
    expect(results.filter(r=>r.status===409)).toHaveLength(1);
  });
});
